// frontend/src/pages/TenderPage.js
import { useState, useEffect } from 'react';
import { getTenders, createTender } from '../services/api';

const TenderPage = () => {
    const [tenders, setTenders] = useState([]);
    const [form, setForm] = useState({ title: '', description: '', budget: '' });

    useEffect(() => {
        const fetchTenders = async () => {
            const { data } = await getTenders();
            setTenders(data);
        };
        fetchTenders();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await createTender(form);
        alert('Tender Created');
        window.location.reload();
    };

    return (
        <div>
            <h1>Government Tenders</h1>

            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Title" onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <input type="text" placeholder="Description" onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                <input type="number" placeholder="Budget" onChange={(e) => setForm({ ...form, budget: e.target.value })} required />
                <button type="submit">Create Tender</button>
            </form>

            <ul>
                {tenders.map((tender) => (
                    <li key={tender.id}>{tender.title} - ${tender.budget}</li>
                ))}
            </ul>
        </div>
    );
};

export default TenderPage;
