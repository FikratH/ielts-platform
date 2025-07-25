import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AdminAssignmentsPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('AdminAssignmentsPage mounted');
  }, []);

  const handleSelect = (type) => {
    if (type === 'writing') {
      navigate('/admin/prompts');
    } else if (type === 'listening') {
      navigate('/admin/listening');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Assignments management (Admin)</h2>
      <div className="flex space-x-4">
        <button
          onClick={() => handleSelect('writing')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Writing
        </button>

        <button
          onClick={() => handleSelect('listening')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Listening
        </button>
      </div>
      
    </div>
  );
};

export default AdminAssignmentsPage; 