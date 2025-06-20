import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(null);

  useEffect(() => {
    setRole(localStorage.getItem("role"));
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("uid");
    localStorage.removeItem("role");
    navigate("/");
  };

  const commonLinks = <></>;

  const studentLinks = (
    <>
      <Link to="/writing/start" className="hover:underline">Writing</Link>
      <Link to="/reading" className="hover:underline">Reading</Link>
      <Link to="/dashboard" className="hover:underline">Кабинет</Link>
    </>
  );

  const adminLinks = (
    <>
      <Link to="/admin/assignments" className="hover:underline">Задания</Link>
      <Link to="/admin/essays" className="hover:underline">Эссе студентов</Link>
    </>
  );

  return (
    <nav className="bg-white border-b shadow-sm p-4 flex justify-between items-center">
      <Link to="/dashboard" className="text-xl font-bold text-blue-700">IELTS Platform</Link>
      <div className="flex gap-5 items-center text-sm text-gray-700">
        {commonLinks}
        {role === 'student' && studentLinks}
        {role === 'admin' && adminLinks}
        <button onClick={handleLogout} className="text-red-600 hover:underline">Выйти</button>
      </div>
    </nav>
  );
};

export default Navbar;
