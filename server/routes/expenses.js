import express from 'express';
import Expense from '../models/Expense.js';
import verifyToken from '../middleware/verifyToken.js';
import User from '../models/User.js';

const router = express.Router();

// Create an expense
router.post('/', verifyToken, async (req, res) => {
    const newExpense = new Expense({ ...req.body, userId: req.user.id });
    try {
        if (req.body.bankId) {
            const user = await User.findById(req.user.id);
            if (user) {
                const bank = user.banks.id(req.body.bankId);
                if (bank) {
                    bank.amount -= req.body.amount;
                    await user.save();
                }
            }
        }
        const savedExpense = await newExpense.save();
        res.status(201).json(savedExpense);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get user expenses
router.get('/', verifyToken, async (req, res) => {
    try {
        const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
        res.status(200).json(expenses);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get current month total
router.get('/monthly', verifyToken, async (req, res) => {
    try {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const expenses = await Expense.find({
            userId: req.user.id,
            date: { $gte: firstDay, $lte: lastDay }
        });

        const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
        res.status(200).json({ total });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Get expenses by specific month and year
router.get('/filter/:year/:month', verifyToken, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        // month param is 1-12
        const month = parseInt(req.params.month) - 1; 
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const expenses = await Expense.find({
            userId: req.user.id,
            date: { $gte: firstDay, $lte: lastDay }
        }).sort({ date: -1 });

        const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
        res.status(200).json({ expenses, total });
    } catch (err) {
        res.status(500).json(err);
    }
});

// Update an expense
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (expense.userId.toString() !== req.user.id) {
            return res.status(403).json("You can only update your own expenses");
        }

        const user = await User.findById(req.user.id);
        if (user) {
            // Revert old amount from old bank
            if (expense.bankId) {
                const oldBank = user.banks.id(expense.bankId);
                if (oldBank) {
                    oldBank.amount += expense.amount;
                }
            }
            
            // Apply new amount to new bank
            const newBankId = req.body.bankId !== undefined ? req.body.bankId : expense.bankId;
            const newAmount = req.body.amount !== undefined ? req.body.amount : expense.amount;
            
            if (newBankId) {
                const newBank = user.banks.id(newBankId);
                if (newBank) {
                    newBank.amount -= newAmount;
                }
            }
            await user.save();
        }

        const updatedExpense = await Expense.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.status(200).json(updatedExpense);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Delete an expense
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (expense.userId.toString() !== req.user.id) {
            return res.status(403).json("You can only delete your own expenses");
        }

        if (expense.bankId) {
            const user = await User.findById(req.user.id);
            if (user) {
                const bank = user.banks.id(expense.bankId);
                if (bank) {
                    bank.amount += expense.amount;
                    await user.save();
                }
            }
        }

        await expense.deleteOne();
        res.status(200).json("Expense has been deleted...");
    } catch (err) {
        res.status(500).json(err);
    }
});

export default router;
