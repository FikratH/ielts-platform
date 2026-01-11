import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import ReadingTestPlayer from '../components/ReadingTestPlayer';
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

const ReadingPage = () => {
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/reading-tests/');
            setTests(response.data);
            setIsLoading(false);
        } catch (error) {
            setError('Failed to load tests');
            setIsLoading(false);
        }
    };

    const startTest = (test) => {
        setSelectedTest(test);
    };

    const handleTestComplete = (sessionId) => {
        navigate(`/reading-result/${sessionId}`);
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

    if (selectedTest) {
        return (
            <ReadingTestPlayer 
                testId={selectedTest.id} 
                onComplete={handleTestComplete}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-3 sm:p-6">
            <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full mb-6 shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-emerald-700 mb-4">
                    IELTS Reading Tests
                </h1>
            </div>

            {(() => {
                const filteredTests = tests.filter(test => test.is_active && !test.is_diagnostic_template);
                return (
                    <TestCardsCarousel>
                {filteredTests.map((test, index) => (
                    <div 
                        key={test.id}
                        data-card
                        className="group relative bg-white rounded-xl md:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 border border-gray-100 overflow-hidden flex flex-col h-full flex-shrink-0 w-[calc(100%-80px)] min-w-[280px] max-w-[320px] sm:w-[calc(100%-100px)] sm:min-w-[300px] sm:max-w-[340px] md:w-auto md:min-w-0 md:max-w-none snap-center"
                        style={{
                            background: `linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)`,
                        }}
                    >
                        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
                        
                        <div className="p-4 sm:p-6 md:p-8">
                            <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-3 md:mb-4 gap-2 md:gap-3">
                                <h3 className="font-bold text-base sm:text-xl md:text-2xl text-gray-800 leading-tight group-hover:text-emerald-700 transition-colors duration-300 line-clamp-2">
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
                                {test.description || 'Practice your reading with IELTS-style passages and questions.'}
                            </p>
                        </div>
                        
                        <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 mt-auto">
                            <div className="flex justify-around text-center mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg md:rounded-xl border border-emerald-100">
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mb-1 md:mb-2 shadow-md">
                                        <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <span className="font-bold text-base md:text-lg text-gray-800">
                                        {test.parts?.length || 0}
                                    </span>
                                    <span className="text-[10px] md:text-xs text-gray-600 font-medium">Parts</span>
                                </div>
                                
                                <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-1 md:mb-2 shadow-md">
                                        <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span className="font-bold text-base md:text-lg text-gray-800">{test.time_limit || 60}</span>
                                    <span className="text-[10px] md:text-xs text-gray-600 font-medium">Minutes</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => startTest(test)}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-bold text-sm md:text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0 focus:outline-none focus:ring-4 focus:ring-emerald-300 active:scale-95"
                            >
                                <span className="flex items-center justify-center">Start Test</span>
                            </button>
                            {test.user_completed && test.explanation_url && (
                              <a
                                href={test.explanation_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 md:mt-3 inline-flex w-full items-center justify-center bg-white text-emerald-700 border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold text-xs md:text-sm shadow-sm transition-all duration-200"
                              >
                                Test explanation
                              </a>
                            )}
                        </div>
                        
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    </div>
                ))}
                    </TestCardsCarousel>
                );
            })()}

            {tests.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 mt-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No Reading tests available</h3>
                    <p className="text-base">Check back later for new tests or contact your administrator.</p>
                </div>
            )}
        </div>
    );
};

export default ReadingPage; 