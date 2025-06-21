import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ListeningTestListPage = () => {
  const [tests, setTests] = useState([]);
  const [userRole, setUserRole] = useState(null); 
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/listening/tests/')
      .then(res => setTests(res.data))
      .catch(err => console.error(err));
    const role = localStorage.getItem('role');
    setUserRole(role);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">IELTS Listening Tests</h2>
      {userRole === 'admin' ? (
        <button
          onClick={() => navigate('/admin/listening')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
        >
          Manage Listening Tests
        </button>
      ) : null}
      {tests.length === 0 ? (
        <p>Нет доступных тестов.</p>
      ) : (
        <ul className="space-y-4">
          {tests.map(test => (
            <li key={test.id} className="border p-4 rounded shadow-sm flex items-center justify-between">
              <div>
                <p className="font-semibold">{test.title}</p>
                <p className="text-sm text-gray-600">{test.description}</p>
              </div>
              <button
                onClick={() => navigate(`/listening-test/${test.id}`)}
                className="ml-4 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                Start Test
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ListeningTestListPage; 