import React, { useEffect, useState } from 'react';
import axios from 'axios';

const initialForm = {
  student_id: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  group: '',
  teacher: '',
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/admin/students/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(res.data);
    } catch (err) {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (editId) {
        // PATCH для редактирования
        await axios.patch(`/api/admin/students/${editId}/`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // POST для создания
        await axios.post('/api/admin/create-student/', form, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setShowForm(false);
      setForm(initialForm);
      setEditId(null);
      fetchStudents();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Ошибка при сохранении');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = student => {
    setForm({ ...student, password: '' });
    setEditId(student.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setFormLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/admin/students/${deleteId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowDelete(false);
      setDeleteId(null);
      fetchStudents();
    } catch (err) {
      setFormError('Ошибка при удалении');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Students</h1>
      <div className="mb-4 flex justify-end">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => { setShowForm(true); setEditId(null); setForm(initialForm); }}
        >
          + Add Student
        </button>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border rounded-xl overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">Student ID</th>
                <th className="px-4 py-2">First Name</th>
                <th className="px-4 py-2">Last Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Group</th>
                <th className="px-4 py-2">Teacher</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{s.student_id}</td>
                  <td className="px-4 py-2">{s.first_name}</td>
                  <td className="px-4 py-2">{s.last_name}</td>
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2">{s.group}</td>
                  <td className="px-4 py-2">{s.teacher}</td>
                  <td className="px-4 py-2">
                    <button className="text-blue-600 hover:underline mr-2" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={() => { setShowDelete(true); setDeleteId(s.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <form
            className="bg-white rounded-xl p-8 w-full max-w-xl shadow-xl"
            onSubmit={handleSubmit}
          >
            <h2 className="text-2xl font-bold mb-4">{editId ? 'Edit Student' : 'Add New Student'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input name="student_id" value={form.student_id} onChange={handleInput} placeholder="Student ID *" className="border p-2 rounded" required />
              <input name="first_name" value={form.first_name} onChange={handleInput} placeholder="First Name *" className="border p-2 rounded" required />
              <input name="last_name" value={form.last_name} onChange={handleInput} placeholder="Last Name *" className="border p-2 rounded" required />
              <input name="email" value={form.email} onChange={handleInput} placeholder="Email *" className="border p-2 rounded" required type="email" />
              <input name="password" value={form.password} onChange={handleInput} placeholder="Password * (min 6 chars)" className="border p-2 rounded" type="password" minLength={editId ? 0 : 6} />
              <input name="group" value={form.group} onChange={handleInput} placeholder="Group" className="border p-2 rounded" />
              <input name="teacher" value={form.teacher} onChange={handleInput} placeholder="Teacher" className="border p-2 rounded" />
            </div>
            {formError && <div className="text-red-600 mb-2">{formError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={() => { setShowForm(false); setEditId(null); }} disabled={formLoading}>Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={formLoading}>{formLoading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Save' : 'Create Student')}</button>
            </div>
          </form>
        </div>
      )}
      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl text-center">
            <h2 className="text-xl font-bold mb-4">Delete Student?</h2>
            <p className="mb-6">Are you sure you want to delete this student? This action cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <button className="px-4 py-2 rounded bg-gray-200" onClick={() => { setShowDelete(false); setDeleteId(null); }} disabled={formLoading}>Cancel</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={handleDelete} disabled={formLoading}>{formLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 