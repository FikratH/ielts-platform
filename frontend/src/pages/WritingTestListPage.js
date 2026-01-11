import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function TestCardsCarousel({ children }) {
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    
    const observer = new ResizeObserver(checkScroll);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScroll);
      observer.disconnect();
    };
  }, []);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const firstCard = container.querySelector('div[data-card]');
      if (!firstCard) return;
      
      const cardWidth = firstCard.offsetWidth;
      const gap = 16; // gap-4 = 16px
      const scrollAmount = cardWidth + gap;
      
      // Use scrollBy for smoother animation
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      
      // Check scroll position after animation
      setTimeout(checkScroll, 500);
    }
  };

  return (
    <div className="relative mb-6 md:mb-0">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full p-2 sm:p-3 shadow-lg border border-gray-200 md:hidden transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Previous test"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
        </button>
      )}
      <div 
        ref={scrollContainerRef}
        className="flex gap-4 md:grid md:grid-cols-2 md:max-w-5xl md:mx-auto overflow-x-auto md:overflow-visible scrollbar-hide snap-x snap-mandatory scroll-smooth test-cards-carousel md:py-8 md:px-8"
        onScroll={checkScroll}
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none'
        }}
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full p-2 sm:p-3 shadow-lg border border-gray-200 md:hidden transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="Next test"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
        </button>
      )}
    </div>
  );
}

const WritingTestListPage = () => {
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        const role = localStorage.getItem('role');
        setUserRole(role);
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/writing-tests/');
            setTests(response.data);
            setIsLoading(false);
        } catch (error) {
            setError('Failed to load tests');
            setIsLoading(false);
        }
    };

    const startTest = async (testId) => {
        try {
            setIsLoading(true);
            const response = await api.post(`/writing-tests/${testId}/start/`);
            const sessionId = response.data.session_id;
            navigate(`/writing/task/${sessionId}`);
        } catch (err) {
            console.error(err);
            alert("Error starting Writing Test");
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 text-center">
                <LoadingSpinner fullScreen text="Loading..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 text-center text-red-500">
                <div>{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 p-3 sm:p-6">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-purple-700 mb-4">IELTS Writing Tests</h1>
            </div>

            {/* Admin Button */}
            {userRole === 'admin' && (
                <div className="mb-8 text-center">
                    <button
                        onClick={() => navigate('/admin/writing-tests')}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Writing Tests
                    </button>
                </div>
            )}

            {/* Tests List */}
            {tests.length === 0 ? (
                <div className="text-center text-gray-600 py-12">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">No Writing Tests Available</h3>
                    <p>Please check back later or contact your administrator.</p>
                </div>
            ) : (
                <TestCardsCarousel>
                    {tests.filter(test => test.is_active && !test.is_diagnostic_template).map((test, index) => (
                        <div 
                            key={test.id}
                            data-card
                            className="group relative bg-white rounded-xl md:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 border border-gray-100 overflow-hidden flex flex-col h-full flex-shrink-0 w-[calc(100%-80px)] min-w-[280px] max-w-[320px] sm:w-[calc(100%-100px)] sm:min-w-[300px] sm:max-w-[340px] md:w-auto md:min-w-0 md:max-w-none snap-center"
                            style={{
                                background: `linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)`,
                            }}
                        >
                            <div className="h-1 bg-gradient-to-r from-purple-500 via-violet-500 to-purple-600"></div>
                            
                            <div className="p-4 sm:p-6 md:p-8">
                                <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3 md:mb-4 gap-2 md:gap-3">
                                    <h3 className="font-bold text-base sm:text-xl md:text-2xl text-gray-800 leading-tight group-hover:text-purple-700 transition-colors duration-300 line-clamp-2">
                                        {test.title}
                                    </h3>
                                    <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-semibold bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md">
                                        <svg className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Available
                                    </span>
                                </div>
                                
                                <p className="text-gray-600 text-xs sm:text-sm md:text-base mb-4 md:mb-6 leading-relaxed line-clamp-2">
                                    {test.description || 'Practice your writing with IELTS-style tasks and get AI-powered feedback.'}
                                </p>
                            </div>
                            
                            <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 mt-auto">
                                <div className="flex justify-around text-center mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg md:rounded-xl border border-purple-100">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center mb-1 md:mb-2 shadow-md">
                                            <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className="font-bold text-base md:text-lg text-gray-800">2</span>
                                        <span className="text-[10px] md:text-xs text-gray-600 font-medium">Tasks</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-1 md:mb-2 shadow-md">
                                            <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <span className="font-bold text-base md:text-lg text-gray-800">60</span>
                                        <span className="text-[10px] md:text-xs text-gray-600 font-medium">Minutes</span>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => startTest(test.id)}
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-sm md:text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed active:scale-95"
                                >
                                    <span className="flex items-center justify-center">
                                        {isLoading ? (
                                            <LoadingSpinner text="Starting..." size="sm" />
                                        ) : (
                                            "Start Test"
                                        )}
                                    </span>
                                </button>
                            </div>
                            
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        </div>
                    ))}
                </TestCardsCarousel>
            )}
        </div>
    );
};

export default WritingTestListPage;

