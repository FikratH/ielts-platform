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
      <Link to="/listening" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Listening</Link>
      <Link to="/reading" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Reading</Link>
      <Link to="/writing/start" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Writing</Link>
      <Link to="/dashboard" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Личный кабинет</Link>
      
    </>
  );

  const adminLinks = (
    <>
      <Link to="/admin/students" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Студенты</Link>
      <Link to="/admin/dashboard" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Панель</Link>
      <Link to="/admin/assignments" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Сабмиты студентов</Link>
      <Link to="/admin/prompts" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Writing</Link>
      <Link to="/admin/listening" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Listening</Link>
      <Link to="/admin/reading" className="text-blue-800 font-medium hover:underline underline-offset-4 transition font-sans">Reading</Link>
      
    </>
  );

  return (
    <nav className="bg-white shadow-md border-b sticky top-0 z-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to={!role ? '/login' : (role === 'admin' ? '/admin/assignments' : '/dashboard')} className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-full shadow bg-white object-cover" />
          <span className="hidden sm:inline text-xl font-semibold text-blue-800 tracking-wide font-sans">Master Education</span>
        </Link>
        <div className="flex items-center gap-6">
          {role === 'student' && studentLinks}
          {role === 'admin' && adminLinks}
          {role && (
            <button onClick={handleLogout} className="ml-4 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-xl shadow transition font-sans">
              Выйти
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
