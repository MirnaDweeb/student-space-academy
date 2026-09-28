/**
 * Official EGSA program catalog, transcribed exactly from
 * "Professional_program-based_roadmap_-_Price_-_Duration.pdf".
 *
 * Rules followed while transcribing:
 * - price/duration are `null` (not 0, not guessed) wherever the source PDF
 *   did not show a number next to that program.
 * - "L.E" (Livre Égyptienne / Egyptian Pound) is recorded as currency "EGP".
 * - "Bundle" prices are only included where the diagram explicitly showed one
 *   for that track+level; tracks/levels with no bundle line have none.
 * - Cybersecurity has NO duration/price data anywhere in the source - only
 *   titles, levels, and associated certification names. Flagged accordingly.
 * - Level labels/order match Course.LEVEL_LABELS (1-4) exactly.
 */

const LEVEL_LABELS = [
  'Awareness / Fundamentals',
  'Core Skills',
  'Specialization/Integration/Applications',
  'Professional/Industry',
];

const CURRENCY = 'EGP';

const TRACKS = [
  {
    category: 'Space Technologies',
    bundles: {}, // no bundle prices given for this track
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Space Fundamentals Program', days: 2, price: 700 },
          { title: 'Satellite Systems Program', days: 2, price: 700 },
          { title: 'Space Systems Engineering', days: 6, price: 1600 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Satellite Subsystems Engineering', days: 5, price: 1500 },
          { title: 'Electrical Power Systems (EPS)', days: 5, price: 1200 },
          { title: 'ADCS Engineering Program', days: 10, price: 3000 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Satellite Communications Program', days: 10, price: 3000 },
          { title: 'CubeSat Development Program', days: 10, price: 3000 },
          { title: 'Ground Control Stations', days: 5, price: 2000 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'End-to-End Space Mission Program', days: 10, price: 4000 },
          { title: "Satellites' Assembly, Integration and Test (AIT)", days: 10, price: 4000 },
          { title: 'Mission Control Center', days: 10, price: 3000 },
        ],
      },
    ],
  },
  {
    category: 'Advanced Technologies',
    bundles: {},
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Programming for Engineers Program', days: 5, price: 2000 },
          { title: 'Digital Logic Fundamentals Program', days: 5, price: 2000 },
          { title: 'Electronics for Computing Systems Program', days: 5, price: 2000 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Embedded Systems Engineering Program', days: 10, price: 4000 },
          { title: 'FPGA & Digital Design Program', days: 10, price: 4000 },
          { title: 'Software Engineering Fundamentals Program', days: 10, price: 3000 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Artificial Intelligence Engineering Program', days: 10, price: 5000 },
          { title: 'RF & Communication Systems Program', days: 10, price: 5000 },
          { title: 'Real-Time Systems Engineering Program', days: 10, price: 4000 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Intelligent Embedded Systems Program', days: 10, price: 5000 },
          { title: 'AI-Driven Systems Integration Program', days: 10, price: 5000 },
          { title: 'High-Performance Computing Systems Program', days: 10, price: 7000 },
        ],
      },
    ],
  },
  {
    category: 'Cybersecurity',
    bundles: {},
    // NO duration/price given anywhere in the source for this entire track -
    // only titles, levels, and associated certification names.
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'IT & Systems Fundamentals Program', days: null, price: null, certifications: ['CompTIA A+', 'CompTIA Linux+'] },
          { title: 'Networking Fundamentals Program', days: null, price: null, certifications: ['CompTIA Network+'] },
          { title: 'Security Fundamentals Program', days: null, price: null, certifications: ['CompTIA Security+'] },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Network Defense Program', days: null, price: null, certifications: ['Certified Network Defender (CND)'] },
          { title: 'Security Operations Center (SOC) Program', days: null, price: null, certifications: ['Certified SOC Analyst (CSA)'] },
          { title: 'Incident Handling & Response Program', days: null, price: null, certifications: ['Certified Incident Handler (ECIH)'] },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Ethical Hacking Program', days: null, price: null, certifications: ['Certified Ethical Hacker (CEH AI)'] },
          { title: 'Penetration Testing Program', days: null, price: null, certifications: ['CompTIA PenTest+', 'Certified Penetration Testing Professional (CPENT AI)'] },
          { title: 'Cyber Threat Intelligence & Analysis Program', days: null, price: null, certifications: ['Certified Threat Intelligence Analyst (CTIA)', 'CompTIA CySA+'] },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Digital Forensics Program', days: null, price: null, certifications: ['Computer Hacking Forensic Investigator (CHFI)'] },
          { title: 'Cloud & Enterprise Security Program', days: null, price: null, certifications: ['Certified Cloud Security Professional (CCSP)', 'CISSP (as advanced security architecture path)'] },
          { title: 'Cybersecurity Leadership & Governance Program', days: null, price: null, certifications: ['Certified Chief Information Security Officer (CCISO)'] },
        ],
      },
    ],
  },
  {
    category: 'Remote Sensing & Geospatial Analytics',
    bundles: {},
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Geospatial Fundamentals Program', days: 3, price: 1000 },
          { title: 'Earth Observation Basics Program', days: 3, price: 1000 },
          { title: 'Introduction to Spatial Data Program', days: 3, price: 1000 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'GIS & Spatial Analysis Program', days: 5, price: 1200 },
          { title: 'Satellite Data Processing Program', days: 5, price: 1200 },
          { title: 'Remote Sensing Fundamentals Program', days: 5, price: 1200 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Remote Sensing Applications Program', days: 5, price: 1600 },
          { title: 'Environmental Analytics Program', days: 5, price: 1600 },
          { title: 'Urban & Infrastructure Analysis Program', days: 5, price: 1600 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'AI in Geospatial Analytics Program', days: 7, price: 3000 },
          { title: 'Geospatial Decision Support Systems Program', days: 6, price: 5000 },
          { title: 'EO Mission & Intelligence Program', days: 7, price: 5000 },
        ],
      },
    ],
  },
  {
    category: 'Electronics & Technology Manufacturing',
    bundles: { 1: 2000, 2: 3500, 3: 4000 }, // Level 4 bundle not given
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Electronics Fundamentals Program', days: 2, price: 800 },
          { title: 'Measurement & Instrumentation Program', days: 3, price: 1000 },
          { title: 'Electrical Circuits Basics Program', days: 3, price: 1000 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Circuit Design Program', days: 5, price: 2000 },
          { title: 'PCB Design & Simulation Program', days: 5, price: 2000 },
          { title: 'Analog & Digital Electronics Program', days: 4, price: 1500 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Electronics Prototyping Program', days: 4, price: 2000 },
          { title: 'Embedded Hardware Design Program', days: 5, price: 2500 },
          { title: 'Testing & Validation Program', days: 5, price: 2500 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Smart Manufacturing Systems Program', days: 5, price: 4000 },
          { title: 'High-Reliability Electronics Program', days: 5, price: 5000 },
          { title: 'Industrial Production & Certification Program', days: 5, price: 5000 },
        ],
      },
    ],
  },
  {
    category: 'Environment & Space Weather',
    bundles: { 1: 2000, 2: 2500, 3: 3000, 4: 5000 }, // all four given
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Environmental Science Fundamentals Program', days: 2, price: 1000 },
          { title: 'Atmospheric Physics Program', days: 3, price: 1000 },
          { title: 'Introduction to Extreme Environments Program', days: 2, price: 1000 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Environmental Effects on Systems Program', days: 3, price: 1200 },
          { title: 'Radiation & Thermal Engineering Program', days: 4, price: 1500 },
          { title: 'Environmental Data Analysis Program', days: 3, price: 1200 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Space Environment & Space Weather Program', days: 5, price: 2000 },
          { title: 'Environmental Modeling Program', days: 5, price: 1500 },
          { title: 'Climate & Space Interaction Program', days: 4, price: 1500 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Applied Environmental Systems Program', days: 4, price: 2000 },
          { title: 'Space Weather Impact Analysis Program', days: 4, price: 2000 },
          { title: 'Forecasting & Resilience Engineering Program', days: 5, price: 3000 },
        ],
      },
    ],
  },
  {
    category: 'Robotics & Autonomous Systems',
    bundles: { 1: 2000, 2: 2500, 3: 4000 }, // Level 4 bundle not given
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Robotics Fundamentals Program', days: 2, price: 1000 },
          { title: 'Sensors & Actuators Program', days: 3, price: 1200 },
          { title: 'Introduction to Mechatronics Program', days: 3, price: 1200 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Control Systems Engineering Program', days: 5, price: 1800 },
          { title: 'Mobile Robotics Program', days: 4, price: 1500 },
          { title: 'Embedded Robotics Program', days: 5, price: 1800 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Autonomous Systems Engineering Program', days: 5, price: 2000 },
          { title: 'Computer Vision for Robotics Program', days: 4, price: 1500 },
          { title: 'AI Robotics Program', days: 5, price: 3000 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Robotics Systems Integration Program', days: 5, price: 3500 },
          { title: 'Human–Machine Interaction Program', days: 5, price: 3500 },
          { title: 'Autonomous Mission Systems Program', days: 5, price: 3500 },
        ],
      },
    ],
  },
  {
    category: 'Technology Entrepreneurship',
    bundles: { 1: 1000, 2: 2500, 3: 4500 }, // Level 4 bundle not given
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Introduction to Technology Business Program', days: 2, price: 500 },
          { title: 'Innovation & Market Awareness Program', days: 3, price: 800 },
          { title: 'Entrepreneurship Fundamentals Program', days: 3, price: 800 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Startup Development Program', days: 4, price: 1800 },
          { title: 'Business Model Design Program', days: 3, price: 1500 },
          { title: 'Product Strategy Program', days: 3, price: 1200 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Technology Venture Development Program', days: 5, price: 2000 },
          { title: 'Deep-Tech Business Program', days: 4, price: 3000 },
          { title: 'Market Validation Program', days: 5, price: 2500 },
        ],
      },
      {
        tier: 4,
        courses: [
          { title: 'Go-to-Market Strategy Program', days: 4, price: 2000 },
          { title: 'Investment & Fundraising Program', days: 4, price: 2000 },
          { title: 'Venture Scaling & Expansion Program', days: 4, price: 2000 },
        ],
      },
    ],
  },
  {
    category: 'Project & Program Management',
    bundles: { 1: 1200, 2: 2500 }, // Level 3 and Level 4 bundles not given
    levels: [
      {
        tier: 1,
        courses: [
          { title: 'Project Management Fundamentals Program', days: 2, price: 500 },
          { title: 'Planning & Scheduling Basics Program', days: 3, price: 800 },
          { title: 'Team Management Program', days: 3, price: 800 },
        ],
      },
      {
        tier: 2,
        courses: [
          { title: 'Cost & Risk Management Program', days: 3, price: 800 },
          { title: 'Project Control & Monitoring Program', days: 3, price: 1200 },
          { title: 'Agile Project Management Program', days: 3, price: 1200 },
        ],
      },
      {
        tier: 3,
        courses: [
          { title: 'Engineering Project Management Program', days: 5, price: 1500 },
          { title: 'Project Management Professional (PMP)', days: 6, price: 5000 },
          { title: 'Certified Associate in Project Management (CAPM)', days: 5, price: 3000 },
        ],
      },
      {
        tier: 4,
        // Durations ARE given (8, 6, 8 days) but NO prices were shown in the
        // source for any of these three - price left null, not guessed.
        courses: [
          { title: 'Program Management Professional (PgMP)', days: 8, price: null },
          { title: 'Agile Certified Practitioner (PMI-ACP)', days: 6, price: null },
          { title: 'Portfolio Management Professional (PfMP)', days: 8, price: null },
        ],
      },
    ],
  },
];

module.exports = { TRACKS, LEVEL_LABELS, CURRENCY };
