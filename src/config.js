// Load environment variables from .env
import { config } from 'dotenv';
config();

// Only log developer info during development to avoid leaking information in production logs.
if (process.env.NODE_ENV !== 'production') {
    console.log(`Desarrollador FrontEnd: ${process.env.desarrolladorFrontEnd}`);
}

export default {
    puerto: process.env.puerto
};
