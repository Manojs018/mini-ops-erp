import app from './app';

const PORT = process.env.PORT || 4000;

process.on('unhandledRejection', (reason) => {
  console.error('>>> [Unhandled Rejection]:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('>>> [Uncaught Exception]:', error);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
