const mongoose = require('mongoose');
const axios = require('axios');
const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());

// MongoDB Schema
const transactionSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  category: String,
  dateOfSale: Date,
  sold: Boolean,
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/transactions', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Fetch Data from API and Seed Database
app.get('/api/initialize', async (req, res) => {
  try {
    const { data } = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    await Transaction.deleteMany();  // Clear existing data
    await Transaction.insertMany(data);  // Seed with new data
    res.status(200).send('Database initialized successfully');
  } catch (error) {
    res.status(500).send('Error initializing database');
  }
});

// API to List All Transactions (with Search and Pagination)
app.get('/api/transactions', async (req, res) => {
    const { page = 1, perPage = 10, search } = req.query;
    const query = search
      ? {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { price: { $regex: search, $options: 'i' } }
          ]
        }
      : {};
  
    try {
      const transactions = await Transaction.find(query)
        .skip((page - 1) * perPage)
        .limit(Number(perPage));
      const count = await Transaction.countDocuments(query);
      res.status(200).json({ transactions, total: count });
    } catch (error) {
      res.status(500).send('Error fetching transactions');
    }
  });

  

//   API for Statistics
app.get('/api/statistics/:month', async (req, res) => {
    const { month } = req.params;
    const startOfMonth = new Date(`${month} 1`);
    const endOfMonth = new Date(`${month} 31`);
  
    try {
      const totalSales = await Transaction.aggregate([
        {
          $match: {
            dateOfSale: { $gte: startOfMonth, $lte: endOfMonth },
            sold: true
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$price' },
            totalSoldItems: { $sum: 1 }
          }
        }
      ]);
  
      const totalUnsoldItems = await Transaction.countDocuments({
        dateOfSale: { $gte: startOfMonth, $lte: endOfMonth },
        sold: false
      });
  
      res.status(200).json({ totalSales, totalUnsoldItems });
    } catch (error) {
      res.status(500).send('Error fetching statistics');
    }
  });

//   API for Bar Chart
app.get('/api/bar-chart/:month', async (req, res) => {
    const { month } = req.params;
    const startOfMonth = new Date(`${month} 1`);
    const endOfMonth = new Date(`${month} 31`);
  
    const priceRanges = [
      { min: 0, max: 100 },
      { min: 101, max: 200 },
      { min: 201, max: 300 },
      { min: 301, max: 400 },
      { min: 401, max: 500 },
      { min: 501, max: 600 },
      { min: 601, max: 700 },
      { min: 701, max: 800 },
      { min: 801, max: 900 },
      { min: 901, max: Infinity }
    ];
  
    try {
      const results = await Promise.all(
        priceRanges.map(async (range) => {
          const count = await Transaction.countDocuments({
            dateOfSale: { $gte: startOfMonth, $lte: endOfMonth },
            price: { $gte: range.min, $lte: range.max }
          });
          return { range: `${range.min}-${range.max}`, count };
        })
      );
      res.status(200).json(results);
    } catch (error) {
      res.status(500).send('Error fetching bar chart data');
    }
  });

//   API for Pie Chart
app.get('/api/pie-chart/:month', async (req, res) => {
    const { month } = req.params;
    const startOfMonth = new Date(`${month} 1`);
    const endOfMonth = new Date(`${month} 31`);
  
    try {
      const categories = await Transaction.aggregate([
        {
          $match: { dateOfSale: { $gte: startOfMonth, $lte: endOfMonth } }
        },
        {
          $group: { _id: '$category', count: { $sum: 1 } }
        }
      ]);
  
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).send('Error fetching pie chart data');
    }
  });

//   Combine Data from All APIs
app.get('/api/combined/:month', async (req, res) => {
    const { month } = req.params;
  
    try {
      const [transactions, statistics, barChart, pieChart] = await Promise.all([
        axios.get(`http://localhost:3000/api/transactions?month=${month}`),
        axios.get(`http://localhost:3000/api/statistics/${month}`),
        axios.get(`http://localhost:3000/api/bar-chart/${month}`),
        axios.get(`http://localhost:3000/api/pie-chart/${month}`)
      ]);
  
      const combinedData = {
        transactions: transactions.data,
        statistics: statistics.data,
        barChart: barChart.data,
        pieChart: pieChart.data
      };
  
      res.status(200).json(combinedData);
    } catch (error) {
      res.status(500).send('Error fetching combined data');
    }
  });  

// Start Server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
