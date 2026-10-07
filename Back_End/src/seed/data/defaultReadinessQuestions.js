/**
 * Shared/Default Readiness Assessment Question Bank
 * Evaluates:
 * - Logical thinking & problem solving
 * - Scientific & technical fundamentals
 * - Systems & quantitative reasoning
 * - Problem solving & data interpretation
 * - Learning readiness & academic integrity
 * - Operational safety & protocols
 */
const defaultReadinessQuestions = [
  {
    question: 'A telemetry sensor monitoring an onboard subsystem records irregular voltage readings. What is the most appropriate first analytical step to diagnose the signal behavior?',
    options: [
      'Immediately shut down the system without logging further diagnostic data',
      'Plot readings across a time-series to identify trends, periodic noise, or anomalous spikes',
      'Assume the highest peak reading represents the continuous operational baseline',
      'Filter out all odd-numbered data points without checking signal frequency'
    ],
    correctAnswerIndex: 1,
    topic: 'Logical Thinking & Problem Solving',
    difficulty: 'Medium',
    isDefault: true,
  },
  {
    question: 'If System Alpha requires Subsystem Beta to operate, and Subsystem Beta automatically shuts down whenever thermal thresholds are exceeded, which conclusion logically follows?',
    options: [
      'Exceeding thermal thresholds will cause System Alpha to cease operational function',
      'System Alpha will continue running uninterrupted regardless of Subsystem Beta status',
      'Subsystem Beta is completely unaffected by operating temperature levels',
      'System Alpha only requires Subsystem Beta during scheduled maintenance cycles'
    ],
    correctAnswerIndex: 0,
    topic: 'Logical Thinking & Problem Solving',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'In scientific experimentation and instrumentation, why is regular calibration against a traceable standard required?',
    options: [
      'It expands the internal digital memory storage of the instrument hardware',
      'It guarantees that experimental findings always validate prior expectations',
      'It minimizes systematic measurement error and ensures reproducibility of data',
      'It substitutes for the requirement of repeating independent measurement trials'
    ],
    correctAnswerIndex: 2,
    topic: 'Scientific & Technical Fundamentals',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'When electrical power drives a mechanical actuator, what fundamental conservation law determines system efficiency and thermal dissipation?',
    options: [
      'Spontaneous energy amplification occurs during rotary mechanical actuation',
      'Mechanical friction completely destroys a fraction of total universal energy',
      'Electrical potential is permanently converted into immutable physical mass',
      'Total input electrical energy equals useful mechanical work plus thermal dissipation losses'
    ],
    correctAnswerIndex: 3,
    topic: 'Scientific & Technical Fundamentals',
    difficulty: 'Medium',
    isDefault: true,
  },
  {
    question: 'A satellite ground receiver downloads a 600-megabyte science data payload over a dedicated downlink with an effective throughput of 50 megabytes per second. What is the ideal transmission time?',
    options: [
      '6 seconds',
      '12 seconds',
      '30 seconds',
      '60 seconds'
    ],
    correctAnswerIndex: 1,
    topic: 'Systems & Quantitative Reasoning',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'What is the primary architectural advantage of designing modular systems with standardized interfaces and loose component coupling?',
    options: [
      'A component fault will immediately cascade and disable every other interconnected unit',
      'It eliminates the need for unit testing, documentation, and telemetry monitoring',
      'Individual modules can be upgraded, debugged, and tested independently without redesigning the whole system',
      'It requires all subsystem hardware to use identical processing clock rates'
    ],
    correctAnswerIndex: 2,
    topic: 'Systems & Quantitative Reasoning',
    difficulty: 'Medium',
    isDefault: true,
  },
  {
    question: 'When troubleshooting an unexpected drop in communications signal-to-noise ratio (SNR), which methodical approach is most effective?',
    options: [
      'Formulate a hypothesis, systematically isolate individual link variables, and compare to baseline logs',
      'Simultaneously adjust multiple transmitter, amplifier, and antenna settings at random',
      'Disregard signal degradation if the receiving station is still receiving raw carrier waves',
      'Reinstall the complete operating system before checking RF cabling and dish alignment'
    ],
    correctAnswerIndex: 0,
    topic: 'Problem Solving & Data Interpretation',
    difficulty: 'Medium',
    isDefault: true,
  },
  {
    question: 'Two redundant temperature sensors inside an instrument payload report conflicting readings (22°C vs 48°C). What should an engineer do first?',
    options: [
      'Average the two disparate numbers together and log 35°C without further verification',
      'Permanently disable Sensor 2 because high readings indicate unnecessary alarm triggers',
      'Immediately abort the operational program and assume catastrophic hardware failure',
      'Flag a diagnostic anomaly, verify sensor health telemetry, and check auxiliary subsystem indicators'
    ],
    correctAnswerIndex: 3,
    topic: 'Problem Solving & Data Interpretation',
    difficulty: 'Medium',
    isDefault: true,
  },
  {
    question: 'Which learning approach most effectively builds long-term competency in technical and engineering disciplines?',
    options: [
      'Cramming theoretical slide decks immediately preceding milestone assessments',
      'Active problem-solving, structured practice, understanding core principles, and iterative feedback',
      'Memorizing formula outputs without understanding the underlying physical mechanisms',
      'Avoiding practical lab exercises to prioritize passive textbook reading'
    ],
    correctAnswerIndex: 1,
    topic: 'Learning Readiness & Academic Integrity',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'Why is transparent methodology documentation and peer review essential to technical and scientific progress?',
    options: [
      'To prevent external researchers from accessing and analyzing methodology details',
      'To prolong publication timelines until proprietary patents have formally expired',
      'To ensure findings are verifiable, reproducible, and held to rigorous professional integrity standards',
      'To replace experimental validation with consensus-based assumptions'
    ],
    correctAnswerIndex: 2,
    topic: 'Learning Readiness & Academic Integrity',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'Prior to energizing a high-voltage lab test bench or activating experimental hardware, what safety step is mandatory?',
    options: [
      'Verify physical safety interlocks, review emergency stop locations, and ensure personnel clearance',
      'Bypass all ground-fault protection circuits to maximize electrical power delivery',
      'Initiate full-power testing and consult the safety manual only if an unexpected incident occurs',
      'Mute acoustic alarm buzzers to prevent disturbance in the testing facility'
    ],
    correctAnswerIndex: 0,
    topic: 'Operational Safety & Protocols',
    difficulty: 'Easy',
    isDefault: true,
  },
  {
    question: 'If an anomalous caution-and-warning annunciator activates during laboratory simulation, what is the correct immediate protocol?',
    options: [
      'Clear and dismiss the annunciator alert without investigating the triggering threshold',
      'Accelerate the experimental procedure to finish before additional alarms sound',
      'Modify the control software threshold to suppress the alert indicator from appearing again',
      'Halt or safe the ongoing procedure, consult the contingency emergency checklist, and inform the team lead'
    ],
    correctAnswerIndex: 3,
    topic: 'Operational Safety & Protocols',
    difficulty: 'Easy',
    isDefault: true,
  },
];

module.exports = defaultReadinessQuestions;
