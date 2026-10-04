export let mockToken = null;
export let mockExpenses = [];

export const setMockToken = (token) => { mockToken = token; };
export const addMockExpense = (expense) => { mockExpenses.push(expense); };
export const getMockExpenses = () => mockExpenses;
