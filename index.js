const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // PostgreSQL
const logger = require('./logger'); // Logger configuration
const morgan = require('morgan');
const errorHandler = require('./errorMiddleware'); // Custom error handler
const natural = require('natural'); // NLP library
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// PostgreSQL connection setup
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Query endpoint
app.post('/query', async (req, res) => {
    const { query } = req.body;

    try {
        let response;

        if (query.toLowerCase().includes('all products')) {
            // Fetch all products
            const result = await pool.query('SELECT * FROM products');
            response = result.rows;

        } else if (query.toLowerCase().includes('brand')) {
            // Fetch products by brand
            const brand = extractKeyword(query, 'brand');
            const result = await pool.query('SELECT * FROM products WHERE brand = $1', [brand]);
            response = result.rows;

        } else if (query.toLowerCase().includes('category')) {
            // Fetch products by category
            const category = extractKeyword(query, 'category');
            const result = await pool.query('SELECT * FROM products WHERE category = $1', [category]);
            response = result.rows;

        } else if (query.toLowerCase().includes('supplier')) {
            // Fetch supplier details
            const supplier = extractKeyword(query, 'supplier');
            const result = await pool.query('SELECT * FROM suppliers WHERE name ILIKE $1', [`%${supplier}%`]);
            response = result.rows;

        } else if (query.toLowerCase().includes('price range')) {
            // Fetch products within a price range
            const [minPrice, maxPrice] = extractPriceRange(query);
            const result = await pool.query('SELECT * FROM products WHERE price BETWEEN $1 AND $2', [minPrice, maxPrice]);
            response = result.rows;

        } else if (query.toLowerCase().includes('compare')) {
            // Compare two products
            const products = extractComparisonItems(query);
            const result = await pool.query('SELECT * FROM products WHERE name = ANY($1)', [products]);
            response = result.rows;

        } else if (query.toLowerCase().includes('description') || query.toLowerCase().includes('tell me about')) {
            // Get product description
            const productName = extractKeyword(query, 'product');
            const result = await pool.query('SELECT description FROM products WHERE name = $1', [productName]);
            response = result.rows.length ? result.rows[0] : { message: 'No product found with that name.' };

        } else if (query.toLowerCase().includes('available')) {
            // Check product availability
            const productName = extractKeyword(query, 'product');
            const result = await pool.query('SELECT * FROM products WHERE name = $1', [productName]);
            response = result.rows.length
                ? { message: `${productName} is available.` }
                : { message: `${productName} is not available.` };

        } else if (query.toLowerCase().includes('rating') || query.toLowerCase().includes('how good is')) {
            // Get product ratings (if applicable)
            const productName = extractKeyword(query, 'product');
            const result = await pool.query('SELECT rating FROM products WHERE name = $1', [productName]);
            response = result.rows.length
                ? { message: `The rating for ${productName} is ${result.rows[0].rating}.` }
                : { message: `No ratings found for ${productName}.` };

        } else {
            // Default NLP processing for other queries
            response = processQuery(query);
        }

        res.status(200).json(response);

    } catch (error) {
        logger.error('Error handling query:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Helper function to extract a keyword (e.g., brand, product, etc.)
function extractKeyword(query, keyword) {
    const regex = new RegExp(`${keyword} (.+)`, 'i');
    const match = query.match(regex);
    return match ? match[1].trim() : '';
}

// Helper function to extract price range
function extractPriceRange(query) {
    const regex = /(\d+)-(\d+)/;
    const match = query.match(regex);
    return match ? [parseInt(match[1]), parseInt(match[2])] : [0, 0];
}

// Helper function to extract products for comparison
function extractComparisonItems(query) {
    const regex = /compare (.+) and (.+)/i;
    const match = query.match(regex);
    return match ? [match[1].trim(), match[2].trim()] : [];
}

// NLP Query Processing
function processQuery(query) {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(query);
    return { message: `You asked about: ${tokens.join(' ')}` };
}

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
});
