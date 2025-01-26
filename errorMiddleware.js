// filepath: /c:/Users/shaik/Dynamic-Chatbot-with-API-and-MySQL-Integration-for-Retail-Analysis/backend/errorMiddleware.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging

    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) // Include stack trace only in development
    });
};

module.exports = errorHandler;