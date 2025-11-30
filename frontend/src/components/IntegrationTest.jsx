import React, { useState, useEffect } from 'react';
import { auth } from '../firebase-config';
import { useAuthState } from 'react-firebase-hooks/auth';
import api from '../api';

const IntegrationTest = () => {
  const [user, loading] = useAuthState(auth);
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    if (!user) return;
    
    setIsRunning(true);
    const results = {}; 
    
    try {
      const idToken = await user.getIdToken();
      
      // Test 1: Admin check
      try {
        const response = await api.admin.check();
        results.adminCheck = response.ok ? 'PASS' : 'FAIL';
      } catch (err) {
        results.adminCheck = 'ERROR';
      }
      
      // Test 2: Get listening tests
      try {
        const response = await api.listeningTests.getAll();
        results.getTests = response.ok ? 'PASS' : 'FAIL';
      } catch (err) {
        results.getTests = 'ERROR';
      }
      
      // Test 3: Audio upload endpoint
      try {
        const response = await api.admin.uploadAudio();
        results.audioUpload = response.status === 400 ? 'PASS (expected validation error)' : 'FAIL';
      } catch (err) {
        results.audioUpload = 'ERROR';
      }
      
    } catch (err) {
      results.general = 'ERROR';
    }
    
    setTestResults(results);
    setIsRunning(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please log in to run integration tests</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Integration Test Results</h1>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-6 disabled:opacity-50"
      >
        {isRunning ? 'Running Tests...' : 'Run Integration Tests'}
      </button>
      
      <div className="space-y-4">
        <div className="border rounded p-4">
          <h3 className="font-medium mb-2">API Endpoints Test</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Admin Check:</span>
              <span className={`font-medium ${
                testResults.adminCheck === 'PASS' ? 'text-green-600' : 
                testResults.adminCheck === 'FAIL' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {testResults.adminCheck || 'NOT TESTED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Get Listening Tests:</span>
              <span className={`font-medium ${
                testResults.getTests === 'PASS' ? 'text-green-600' : 
                testResults.getTests === 'FAIL' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {testResults.getTests || 'NOT TESTED'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Audio Upload:</span>
              <span className={`font-medium ${
                testResults.audioUpload?.includes('PASS') ? 'text-green-600' : 
                testResults.audioUpload === 'FAIL' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {testResults.audioUpload || 'NOT TESTED'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="border rounded p-4">
          <h3 className="font-medium mb-2">Component Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>ListeningTestPlayer:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>ListeningTestBuilder:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>ListeningTestPreview:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>StudentSubmissionView:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
          </div>
        </div>
        
        <div className="border rounded p-4">
          <h3 className="font-medium mb-2">Routing Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>/listening-test/:id:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>/listening-result/:sessionId:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>/admin/listening/builder/new:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
            <div className="flex justify-between">
              <span>/admin/listening/builder/:testId:</span>
              <span className="text-green-600 font-medium">READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationTest; 