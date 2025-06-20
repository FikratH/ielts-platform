import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ReadingTestListPage = () => {
  const [tests, setTests] = useState([]);
  const [userRole, setUserRole] = useState(null); 
  const navigate = useNavigate();

  useEffect(() => {

    axios.get('/api/reading/tests/')
      .then(res => setTests(res.data))
      .catch(err => console.error(err));

   
    const role = localStorage.getItem('userRole');
    setUserRole(role);
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">IELTS Reading Tests</h2>
      {userRole === 'admin' ? (
        <button
          onClick={() => navigate('/admin/reading')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4"
        >
          Manage Reading Tests
        </button>
      ) : null}
      {tests.length === 0 ? (
        <p>Нет доступных тестов.</p>
      ) : (
        <ul className="space-y-4">
          {tests.map(test => (
            <li key={test.id} className="border p-4 rounded shadow-sm">
              <p className="font-semibold">{test.title}</p>
              <p className="text-sm text-gray-600">{test.description}</p>
              <button
                onClick={() => navigate(`/reading-test/${test.id}`)}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
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

export default ReadingTestListPage; 