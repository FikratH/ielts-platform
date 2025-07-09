import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      {/* Удалена синяя кнопка Students */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/students" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление студентами</h2>
        </Link>
        <Link to="/admin/assignments" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Поиск заданий студентов</h2>
        </Link>
        <Link to="/admin/reading" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление Reading тестами</h2>
        </Link>
        <Link to="/admin/prompts" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление Writing заданиями</h2>
        </Link>
        <Link to="/admin/listening" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление Listening тестами</h2>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboardPage; 