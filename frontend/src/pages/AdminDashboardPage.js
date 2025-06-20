import React from 'react';
import { Link } from 'react-router-dom';

const AdminDashboardPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Панель администратора</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Карточка Поиска Заданий */}
        <Link to="/admin/assignments" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Поиск заданий студентов</h2>
          <p className="text-gray-600 mt-2">Найти и проверить работы, сданные студентами (Reading & Writing).</p>
        </Link>

        {/* Карточка Управления Тестами */}
        <Link to="/admin/reading" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление Reading тестами</h2>
          <p className="text-gray-600 mt-2">Создавать, редактировать и активировать тесты для секции Reading.</p>
        </Link>

        {/* Карточка Управления Промптами */}
        <Link to="/admin/prompts" className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-bold text-gray-800">Управление Writing промптами</h2>
          <p className="text-gray-600 mt-2">Управлять темами и заданиями для секции Writing.</p>
        </Link>

      </div>
    </div>
  );
};

export default AdminDashboardPage; 