import React, { useState } from 'react';

const IELTS_DESCRIPTORS = {
  fluency_coherence: {
    9: "Fluent with only very occasional repetition or self-correction. Any hesitation that occurs is used only to prepare the content of the next utterance and not to find words or grammar. Speech is situationally appropriate and cohesive features are fully acceptable. Topic development is fully coherent and appropriately extended.",
    8: "Fluent with only very occasional repetition or self-correction. Hesitation may occasionally be used to find words or grammar, but most will be content related. Topic development is coherent, appropriate and relevant.",
    7: "Able to keep going and readily produce long turns without noticeable effort. Some hesitation, repetition and/or self-correction may occur, often mid-sentence and indicate problems with accessing appropriate language. However, these will not affect coherence. Flexible use of spoken discourse markers, connectives and cohesive features.",
    6: "Able to keep going and demonstrates a willingness to produce long turns. Coherence may be lost at times as a result of hesitation, repetition and/or self-correction. Uses a range of spoken discourse markers, connectives and cohesive features though not always appropriately.",
    5: "Usually able to keep going, but relies on repetition and self-correction to do so and/or on slow speech. Overuse of certain discourse markers, connectives and other cohesive features. More complex speech usually causes disfluency but simpler language may be produced fluently.",
    4: "Unable to keep going without noticeable pauses. Speech may be slow with frequent repetition. Often self-corrects. Can link simple sentences but often with repetitious use of connectives. Some breakdowns in coherence.",
    3: "Frequent, sometimes long, pauses occur while candidate searches for words. Limited ability to link simple sentences and go beyond simple responses to questions. Frequently unable to convey basic message.",
    2: "Lengthy pauses before nearly every word. Isolated words may be recognisable but speech is of virtually no communicative significance. Little communication possible without the support of mime or gesture.",
    1: "Essentially none. Speech is totally incoherent. No communication possible.",
    0: "Does not attend"
  },
  lexical_resource: {
    9: "Total flexibility and precise usage in all contexts. Sustained use of accurate and idiomatic language.",
    8: "Wide resource, readily and flexibly used to discuss all topics and convey precise meaning. Skilful use of less common and idiomatic items despite occasional inaccuracies in word choice and collocation. Effective use of paraphrase as required.",
    7: "Resource flexibly used to discuss a variety of topics. Some ability to use less common and idiomatic items and an awareness of style and collocation is evident though inappropriates occur. Effective use of paraphrase as required.",
    6: "Resource sufficient to discuss topics at length. Vocabulary use may be inappropriate, but meaning is clear. Generally able to paraphrase successfully.",
    5: "Resource sufficient to discuss familiar and unfamiliar topics but there is limited flexibility. Attempts paraphrase but not always with success. Complex structures are attempted but these are limited in range, nearly often contain errors and may lead to the need for reformulation.",
    4: "Resource sufficient for familiar topics but only basic meaning can be conveyed on unfamiliar topics. Frequent inappropriancies and errors in word choice. Subordinate clauses are rare and, overall, turns are short, structures are repetitive and errors are frequent.",
    3: "Resource limited to simple vocabulary used primarily to convey personal information. Vocabulary inadequate for unfamiliar topics.",
    2: "Very limited resource. Utterances consist of isolated words or memorised utterances. Little communication possible without the support of mime or gesture.",
    1: "No resource bar a few isolated words. No communication possible.",
    0: "Does not attend"
  },
  grammatical_range: {
    9: "Structures are precise and accurate at all times, apart from mistakes characteristic of native speaker speech.",
    8: "Wide range of structures, flexibly used. The majority of sentences are error-free. Occasional basic errors may persist. A few basic errors may persist.",
    7: "A range of structures flexibly used. Error-free sentences are frequent. Both simple and complex sentences are used effectively despite some errors. A few basic errors persist.",
    6: "Produces a mix of short and complex sentence forms and a variety of structures although limited flexibility. Though errors frequently occur in complex structures, these rarely impede communication.",
    5: "Basic sentence forms are fairly well controlled for accuracy. Complex structures are attempted but these are limited in range, nearly often contain errors and may lead to the need for reformulation.",
    4: "Can produce basic sentence forms and some short utterances are error-free. Subordinate clauses are rare and, overall, turns are short, structures are repetitive and errors are frequent.",
    3: "Basic sentence forms are attempted but grammatical errors are numerous except in apparently memorised utterances.",
    2: "No rateable language unless memorised.",
    1: "No rateable language unless memorised.",
    0: "Does not attend"
  },
  pronunciation: {
    9: "Uses a full range of phonological features to convey precise and/or subtle meaning. Flexible use of features of connected speech is sustained throughout. Can be effortlessly understood throughout. Accent has no effect on intelligibility.",
    8: "Uses a wide range of phonological features to convey precise and/or subtle meaning. Flexible use of features of connected speech is sustained throughout, despite occasional lapses. Can sustain appropriate rhythm. Flexible use of stress and intonation across long utterances, despite occasional lapses. Can be easily understood throughout. Accent has minimal effect on intelligibility.",
    7: "Displays all the positive features of band 6, and some, but not all, of the positive features of band 8.",
    6: "Uses a range of phonological features, but control is variable. Chunking is generally appropriate, but rhythm may be affected by a lack of stress-timing and/or rapid speech. Some effective use of intonation and stress, but this is not sustained. Individual words or phonemes are frequently mispronounced, causing lack of clarity. Understanding requires some effort and there may be patches of speech that cannot be understood.",
    5: "Displays all the positive features of band 4 and some, but not all, of the positive features of band 6.",
    4: "Uses some acceptable phonological features, but the range is limited. Produces some acceptable chunking, but there are frequent lapses in overall rhythm. Attempts to use intonation and stress, but control is limited. Individual words and phonemes are frequently mispronounced, causing lack of clarity. Understanding requires some effort and there may be patches of speech that cannot be understood.",
    3: "Displays some features of band 2 and some, but not all, of the positive features of band 4.",
    2: "Uses few acceptable phonological features. Produces some acceptable chunking, but there are frequent lapses in overall rhythm. Overall problems with delivery impair attempts at connected speech. Often unintelligible.",
    1: "Can produce occasional individual words and phonemes that are recognisable, but no overall meaning is conveyed. Unintelligible.",
    0: "Does not attend"
  }
};

const CRITERIA_DESCRIPTIONS = {
  fluency_coherence: "Fluency and Coherence",
  lexical_resource: "Lexical Resource", 
  grammatical_range: "Grammatical Range and Accuracy",
  pronunciation: "Pronunciation"
};

const IELTSSpeakingDescriptors = ({ isExpanded, onToggle }) => {
  const [selectedCriterion, setSelectedCriterion] = useState('fluency_coherence');

  if (!isExpanded) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 bg-gradient-to-r from-white to-gray-50 rounded-xl text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h4 className="text-sm font-semibold text-gray-700">IELTS Speaking Descriptors</h4>
          <svg 
            className="w-5 h-5 text-gray-400"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">IELTS Speaking Band Descriptors</h4>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4">
        {/* Criterion Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(CRITERIA_DESCRIPTIONS).map(([key, title]) => (
            <button
              key={key}
              onClick={() => setSelectedCriterion(key)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                selectedCriterion === key 
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {title}
            </button>
          ))}
        </div>

        {/* Descriptors */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {Object.entries(IELTS_DESCRIPTORS[selectedCriterion] || {})
            .reverse()
            .map(([band, description]) => (
              <div key={band} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className={`text-center px-2 py-1 rounded text-xs font-bold min-w-[2rem] ${
                    parseInt(band) >= 8 ? 'bg-green-100 text-green-700' :
                    parseInt(band) >= 7 ? 'bg-blue-100 text-blue-700' :
                    parseInt(band) >= 6 ? 'bg-yellow-100 text-yellow-700' :
                    parseInt(band) >= 5 ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {band}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-700 leading-relaxed">{description}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>

        
      </div>
    </div>
  );
};

export default IELTSSpeakingDescriptors;
