import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 3003;

app.listen(Number(PORT), () => {
  // eslint-disable-next-line no-console
  console.log(`medcore-appointment listening on port ${PORT}`);
});

