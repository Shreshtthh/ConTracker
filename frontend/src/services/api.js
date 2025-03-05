// frontend/src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

export const getTenders = async () => await api.get('/tenders');
export const createTender = async (data) => await api.post('/tenders/create', data);
