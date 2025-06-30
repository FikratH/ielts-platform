import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ role, setRole }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('role');
    setRole(null);
    navigate('/login');
  };

  const studentLinks = (
    <>
      <Link to="/listening" className="text-white hover:text-gray-200">Listening</Link>
      <Link to="/reading" className="text-white hover:text-gray-200">Reading</Link>
      <Link to="/writing/start" className="text-white hover:text-gray-200">Writing</Link>
      <Link to="/dashboard" className="text-white hover:text-gray-200">Личный кабинет</Link>
      
    </>
  );

  const adminLinks = (
    <>
      <Link to="/admin/dashboard" className="text-white hover:text-gray-200">Панель</Link>
      <Link to="/admin/assignments" className="text-white hover:text-gray-200">Сабмиты студентов</Link>
      <Link to="/admin/reading" className="text-white hover:text-gray-200">Reading</Link>
      <Link to="/admin/prompts" className="text-white hover:text-gray-200">Writing</Link>
      <Link to="/admin/listening" className="text-white hover:text-gray-200">Listening</Link>
      
    </>
  );

  return (
    <nav className="bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
      <Link to={!role ? '/login' : (role === 'admin' ? '/admin/assignments' : '/dashboard')} className="flex items-center gap-3">
        <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-full shadow bg-white object-cover" />
        <span className="hidden sm:inline text-xl font-bold tracking-tight">Master Education</span>
      </Link>
      <div className="flex items-center gap-6">
        {role === 'student' && studentLinks}
        {role === 'admin' && adminLinks}
        {role && (
          <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">
            Выйти
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
