import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AdminBulkImportPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Проверка типа файла
      const fileName = selectedFile.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        setError('Please select a CSV or Excel file');
        return;
      }
      
      // Проверка размера (5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setValidation(null);
      setResult(null);
    }
  };

  const validateFile = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'validate');
      
      const response = await api.post('/admin/bulk-import-students/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setValidation(response.data);
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(`Validation errors:\n${err.response.data.errors.join('\n')}`);
      } else {
        setError(err.response?.data?.error || 'Validation failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const importStudents = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'create');
      
      const response = await api.post('/admin/bulk-import-students/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setResult(response.data);
      setValidation(null);
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(`Import errors:\n${err.response.data.errors.join('\n')}`);
      } else {
        setError(err.response?.data?.error || 'Import failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Создаем CSV шаблон
    const csvContent = `first_name,last_name,email,student_id,password,group,teacher
John,Doe,john.doe@example.com,STU001,password123,Group A,Kamila
Jane,Smith,jane.smith@example.com,STU002,password123,Group B,Aida`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Bulk Import Students</h1>
        <button
          onClick={() => navigate('/admin/students')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back to Students
        </button>
      </div>

      {/* Инструкции */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">Instructions:</h2>
        <ul className="text-blue-700 space-y-1">
          <li>• Upload a CSV or Excel file with student data</li>
          <li>• Required columns: first_name, last_name, email, student_id, password</li>
          <li>• Optional columns: group, teacher</li>
          <li>• Password must be at least 6 characters</li>
          <li>• Email and student_id must be unique</li>
          <li>• Maximum file size: 5MB</li>
        </ul>
        <button
          onClick={downloadTemplate}
          className="mt-3 bg-blunpme-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          Download Template
        </button>
      </div>

      {/* Загрузка файла */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload File</h2>
        
        <div className="mb-4">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {file && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <p><strong>Selected file:</strong> {file.name}</p>
            <p><strong>Size:</strong> {(file.size / 1024).toFixed(1)} KB</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={validateFile}
            disabled={!file || loading}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:bg-gray-400"
          >
            {loading ? 'Validating...' : 'Validate File'}
          </button>
          
          <button
            onClick={importStudents}
            disabled={!file || loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Importing...' : 'Import Students'}
          </button>
        </div>
      </div>

      {/* Ошибки */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
          <pre className="text-red-700 whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      {/* Результат валидации */}
      {validation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-green-800 mb-2">Validation Success!</h3>
          <p className="text-green-700 mb-3">{validation.message}</p>
          
          {validation.preview && validation.preview.length > 0 && (
            <div>
              <h4 className="font-medium text-green-800 mb-2">Preview (first 5 students):</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Student ID</th>
                      <th className="px-3 py-2 text-left">Group</th>
                      <th className="px-3 py-2 text-left">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.preview.map((student, idx) => (
                      <tr key={idx} className="border-b border-green-200">
                        <td className="px-3 py-2">{student.first_name} {student.last_name}</td>
                        <td className="px-3 py-2">{student.email}</td>
                        <td className="px-3 py-2">{student.student_id}</td>
                        <td className="px-3 py-2">{student.group}</td>
                        <td className="px-3 py-2">{student.teacher}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Результат импорта */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-800 mb-2">Import Complete!</h3>
          <p className="text-green-700 mb-3">{result.message}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-3 rounded">
              <p className="font-medium">Created: {result.created_count}</p>
            </div>
            <div className="bg-white p-3 rounded">
              <p className="font-medium">Errors: {result.error_count}</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-red-800 mb-2">Errors:</h4>
              <ul className="text-red-700 text-sm space-y-1">
                {result.errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.created_students && result.created_students.length > 0 && (
            <div>
              <h4 className="font-medium text-green-800 mb-2">Created Students:</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-green-100">
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Student ID</th>
                      <th className="px-3 py-2 text-left">Group</th>
                      <th className="px-3 py-2 text-left">Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created_students.map((student, idx) => (
                      <tr key={idx} className="border-b border-green-200">
                        <td className="px-3 py-2">{student.name}</td>
                        <td className="px-3 py-2">{student.email}</td>
                        <td className="px-3 py-2">{student.student_id}</td>
                        <td className="px-3 py-2">{student.group}</td>
                        <td className="px-3 py-2">{student.teacher}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBulkImportPage;


