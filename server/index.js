import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoute from './routes/auth.js';
import expenseRoute from './routes/expenses.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('DB Connection Successfull!'))
  .catch((err) => console.log(err));

app.use('/api/auth', authRoute);
app.use('/api/expenses', expenseRoute);

app.get('/', (req, res) => {
  res.json('Hello World from Expense Tracker Backend!');
})

app.listen(process.env.PORT || 5000, () => {
    console.log(`Backend server is running on port ${process.env.PORT || 5000}!`);
});
