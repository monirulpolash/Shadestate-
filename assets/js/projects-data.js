/* ==========================================================================
   SHADESTATE — one source of truth for every residence.
   Used by the home page, the projects index, the project page and the map.
   Prices are stored as numbers in the project's own currency (AED / SAR).
   ========================================================================== */
(function () {
  'use strict';

  var IMG = 'assets/img/';
  var KSA = 'assets/ksa/';

  var PROJECTS = {

    'arbour-townhomes': {
      name: 'Arbour Townhomes',
      short: 'Arbour',
      location: 'Dubai Hills, Dubai',
      city: 'Dubai',
      country: 'Dubai',
      status: 'Ongoing',
      type: 'Townhouse',
      handover: 'Q4 2028',
      size: '760 – 1,480 sq. ft.',
      beds: '3 – 4 bedrooms',
      price: 2450000,
      currency: 'AED',
      lat: 25.1005, lon: 55.2410,
      progress: 42,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'Arbour is a collection of garden townhomes set among mature ghaf trees in Dubai Hills. Limestone façades, deep loggias and shaded walkways keep the streets cool; behind them, homes open onto private courtyards and a shared spine of green.',
      note: 'Forty-two townhomes · Three and four bedroom layouts · Private gardens',
      hero: KSA + 'arbour-townhomes.jpg',
      heroAlt: 'Arbour Townhomes — pale limestone townhouses beneath mature ghaf trees in Dubai Hills',
      heroCap: 'Dubai Hills · Phase one',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Arbour Townhomes masterplan, aerial view of the tree-lined streets',
      gallery: [
        { img: KSA + 'arbour-townhomes.jpg', cap: 'Exterior', sub: 'The shaded street' },
        { img: IMG + 'g-lounge.jpg', cap: 'Lounge', sub: 'Double height' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Oak & stone' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Garden outlook' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool deck', sub: 'Shared courtyard' },
        { img: IMG + 'g-street.jpg', cap: 'The walk', sub: 'Ghaf canopy' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'Garden Townhome', plan: IMG + 'plan-3.png', type: 'Three bedroom', size: '2,100 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Garden', pool: 'Plunge', availability: 'Available' },
        { name: 'Courtyard Townhome', plan: IMG + 'plan-2.png', type: 'Four bedroom', size: '2,480 sq.ft', bedrooms: '4', bathrooms: '4', balcony: 'Terrace', pool: 'Plunge', availability: 'Last Units' },
        { name: 'Terrace Townhome', plan: IMG + 'plan-1.png', type: 'Four bedroom', size: '2,640 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Roof terrace', pool: 'Plunge', availability: 'Sold' },
        { name: 'Garden Flat', plan: IMG + 'plan-4.png', type: 'Two bedroom', size: '1,180 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Courtyard', pool: '—', availability: 'Available' }
      ],
      landmarks: [
        { name: 'Downtown Dubai', img: IMG + 'lm-burj-khalifa.jpg', min: 15, km: '13 km' },
        { name: 'Dubai International Airport', img: IMG + 'lm-airport.jpg', min: 22, km: '24 km' },
        { name: 'Dubai Marina', img: IMG + 'lm-marina.jpg', min: 18, km: '16 km' },
        { name: 'Palm Jumeirah', img: IMG + 'lm-beach.jpg', min: 20, km: '19 km' },
        { name: 'Burj Al Arab', img: IMG + 'lm-burj-al-arab.jpg', min: 19, km: '17 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'GEMS Wellington Academy', km: '4.3 km', min: '8 min' },
          { name: 'Dubai Heights Academy', km: '3.6 km', min: '7 min' },
          { name: 'Foremarke School', km: '2.5 km', min: '5 min' }
        ],
        'Healthcare': [
          { name: 'King’s College Hospital Dubai', km: '2.7 km', min: '6 min' },
          { name: 'Mediclinic Parkview Hospital', km: '4.6 km', min: '8 min' }
        ],
        'Groceries': [
          { name: 'Dubai Hills Mall', km: '1.2 km', min: '4 min' },
          { name: 'Spinneys Al Barsha', km: '4.0 km', min: '8 min' },
          { name: 'Mall of the Emirates', km: '7.0 km', min: '12 min' }
        ],
        'Leisure': [
          { name: 'Dubai Hills Golf Club', km: '1.9 km', min: '5 min' },
          { name: 'Dubai Hills Park', km: '1.6 km', min: '4 min' },
          { name: 'Al Barsha Pond Park', km: '5.9 km', min: '10 min' }
        ]
      },
      faqDiff: 'Tree-lined streets, shaded walkways and homes that open onto shared green courtyards.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. The community is pet-friendly, with dog-walking trails and a fenced pet park.',
      schools: 'Several international schools are within a 10-minute drive. Our team can share the full list on request.'
    },

    'diriyah-courtyard-villas': {
      name: 'Diriyah Courtyard Villas',
      short: 'Diriyah',
      location: 'Diriyah, Riyadh',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      status: 'Ongoing',
      type: 'Villa',
      handover: 'Q4 2027',
      size: '4,200 – 5,600 sq. ft.',
      beds: '4 – 5 bedrooms',
      price: 4200000,
      currency: 'SAR',
      lat: 24.7340, lon: 46.5740,
      progress: 55,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'A walled collection of twenty-four villas on the western edge of Diriyah, drawn from the Najdi courtyard house: thick earth walls, triangular openings, timber screens and a shaded inner court with a single palm. The houses sit low against the wadi and take their colour from the ground they stand on.',
      note: 'Twenty-four villas · Four and five bedroom layouts · Walled courtyards',
      hero: KSA + 'diriyah-courtyard-villas.jpg',
      heroAlt: 'Diriyah Courtyard Villas — rammed-earth walls, triangular openings and date palms in a shaded courtyard',
      heroCap: 'Diriyah · The courtyard houses',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Diriyah Courtyard Villas masterplan, aerial view of the walled clusters',
      gallery: [
        { img: KSA + 'diriyah-courtyard-villas.jpg', cap: 'Courtyard', sub: 'The inner court' },
        { img: IMG + 'g-lounge.jpg', cap: 'Majlis', sub: 'North light' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Wadi outlook' },
        { img: IMG + 'g-reading.jpg', cap: 'Study', sub: 'Timber screen' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool court', sub: 'Private pool' }
      ],
      amenities: ['Walled Private Courtyards', 'Family Majlis', 'Private Pools', 'Landscaped Wadi Edge', 'Fitness Suite', 'Guest Suite', 'Covered Parking', '24/7 Security'],
      layouts: [
        { name: 'Courtyard Villa', plan: IMG + 'plan-3.png', type: 'Four bedroom', size: '4,200 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Courtyard', pool: 'Private', availability: 'Available' },
        { name: 'Palm Court Villa', plan: IMG + 'plan-2.png', type: 'Five bedroom', size: '5,600 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' },
        { name: 'Wadi Villa', plan: IMG + 'plan-1.png', type: 'Five bedroom', size: '5,900 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Terrace', pool: 'Private', availability: 'Sold' },
        { name: 'Guest House', plan: IMG + 'plan-4.png', type: 'Two bedroom', size: '1,650 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Court', pool: '—', availability: 'Available' }
      ],
      landmarks: [
        { name: 'Diriyah Gate', img: KSA + 'lm-diriyah.jpg', min: 5, km: '4 km' },
        { name: 'KAFD, Riyadh', img: KSA + 'lm-riyadh.jpg', min: 18, km: '16 km' },
        { name: 'Downtown Riyadh', img: KSA + 'lm-riyadh.jpg', min: 15, km: '12 km' },
        { name: 'King Khalid International Airport', img: KSA + 'lm-riyadh.jpg', min: 30, km: '38 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'King’s College Riyadh', km: '6.2 km', min: '11 min' },
          { name: 'Alfaisal International Academy', km: '8.4 km', min: '14 min' },
          { name: 'British International School Riyadh', km: '10.1 km', min: '17 min' }
        ],
        'Healthcare': [
          { name: 'Dr Sulaiman Al Habib, Olaya', km: '9.8 km', min: '16 min' },
          { name: 'King Faisal Specialist Hospital', km: '12.4 km', min: '20 min' }
        ],
        'Groceries': [
          { name: 'Diriyah Gate retail', km: '3.4 km', min: '6 min' },
          { name: 'Panorama Mall', km: '8.7 km', min: '14 min' },
          { name: 'Riyadh Front', km: '24.0 km', min: '25 min' }
        ],
        'Leisure': [
          { name: 'Wadi Hanifah trails', km: '2.1 km', min: '5 min' },
          { name: 'Diriyah Art Futures', km: '4.6 km', min: '8 min' },
          { name: 'At-Turaif District', km: '5.2 km', min: '9 min' }
        ]
      },
      faqDiff: 'A walled Najdi courtyard, earth walls that stay cool through summer, and a house that reads as part of Diriyah.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. Each villa has a walled garden, and the wadi edge is a short walk from the gate.',
      schools: 'Several international schools are within a 20-minute drive; our Riyadh team can share the full list.'
    },

    'sun-bliss-residence': {
      name: 'Sun-Bliss Residence',
      short: 'Sun-Bliss',
      location: 'Palm Jumeirah, Dubai',
      city: 'Dubai',
      country: 'Dubai',
      status: 'Completed',
      type: 'Villa',
      handover: 'Delivered 2023',
      size: '6,400 – 8,200 sq. ft.',
      beds: '5 – 6 bedrooms',
      price: 18500000,
      currency: 'AED',
      lat: 25.1124, lon: 55.1390,
      progress: 100,
      plan: [['100%', 'Delivered'], ['—', 'Title deed issued']],
      overview: 'A low beach house on the western frond of Palm Jumeirah, arranged so that every principal room looks north across the pool to the Dubai skyline. Deep limestone loggias shade the glass, and the roof is planted to keep the house cool from above as well as from the side.',
      note: 'Six beach villas · Five and six bedroom layouts · Private beach and pool',
      hero: KSA + 'sun-bliss-residence.jpg',
      heroAlt: 'Sun-Bliss Residence — a limestone beach villa with an infinity pool and the Dubai skyline across the water',
      heroCap: 'Palm Jumeirah · The west frond',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Sun-Bliss Residence masterplan, aerial view of the frond',
      gallery: [
        { img: KSA + 'sun-bliss-residence.jpg', cap: 'Exterior', sub: 'Pool and beach' },
        { img: IMG + 'g-lounge.jpg', cap: 'Living room', sub: 'Skyline view' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Sea outlook' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool deck', sub: 'Private beach' },
        { img: IMG + 'lm-burj-al-arab.jpg', cap: 'The view', sub: 'Burj Al Arab' }
      ],
      amenities: ['Private Beach', 'Infinity Pool', 'Planted Roof Terrace', 'Summer Kitchen', 'Staff Quarters', 'Beach Club Access', 'Covered Parking', '24/7 Security'],
      layouts: [
        { name: 'Beach Villa', plan: IMG + 'plan-3.png', type: 'Five bedroom', size: '6,400 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Roof terrace', pool: 'Private', availability: 'Sold' },
        { name: 'Grand Beach Villa', plan: IMG + 'plan-1.png', type: 'Six bedroom', size: '8,200 sq.ft', bedrooms: '6', bathrooms: '7', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' },
        { name: 'Sky Villa', plan: IMG + 'plan-2.png', type: 'Four bedroom', size: '5,100 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Terrace', pool: 'Private', availability: 'Sold' }
      ],
      landmarks: [
        { name: 'Dubai Marina', img: IMG + 'lm-marina.jpg', min: 10, km: '7 km' },
        { name: 'Burj Al Arab', img: IMG + 'lm-burj-al-arab.jpg', min: 12, km: '9 km' },
        { name: 'Downtown Dubai', img: IMG + 'lm-burj-khalifa.jpg', min: 20, km: '15 km' },
        { name: 'Dubai International Airport', img: IMG + 'lm-airport.jpg', min: 25, km: '22 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Dubai British School Emirates Hills', km: '9.4 km', min: '14 min' },
          { name: 'GEMS Dubai American Academy', km: '11.2 km', min: '17 min' },
          { name: 'Regent International School', km: '12.6 km', min: '19 min' }
        ],
        'Healthcare': [
          { name: 'Mediclinic Al Sufouh', km: '7.8 km', min: '12 min' },
          { name: 'King’s College Hospital Dubai', km: '13.0 km', min: '18 min' }
        ],
        'Groceries': [
          { name: 'Nakheel Mall', km: '2.4 km', min: '6 min' },
          { name: 'Spinneys Palm Jumeirah', km: '1.9 km', min: '5 min' },
          { name: 'Mall of the Emirates', km: '10.4 km', min: '16 min' }
        ],
        'Leisure': [
          { name: 'Palm Jumeirah Boardwalk', km: '1.0 km', min: '3 min' },
          { name: 'Kyma Beach', km: '1.4 km', min: '4 min' },
          { name: 'Atlantis Aquaventure', km: '3.2 km', min: '8 min' }
        ]
      },
      faqDiff: 'A private beach, a north-facing pool deck and the skyline held in one line across the water.',
      payment: 'Residences are complete; title deed issued on transfer.',
      pets: 'Yes. The villa gardens are walled and the beach is private.',
      schools: 'Several international schools are within a 20-minute drive. Our team can share the full list on request.'
    },

    'red-sea-horizon': {
      name: 'Red Sea Horizon',
      short: 'Horizon',
      location: 'Jeddah, Saudi Arabia',
      city: 'Jeddah',
      country: 'Saudi Arabia',
      status: 'Upcoming',
      type: 'Waterfront residences',
      handover: 'Q1 2029',
      size: '2,800 – 4,100 sq. ft.',
      beds: '3 – 4 bedrooms',
      price: 6800000,
      currency: 'SAR',
      lat: 21.5600, lon: 39.1500,
      progress: 12,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'A terraced waterfront settlement north of the Jeddah Corniche, cut into the coral shelf so that each residence has an uninterrupted line to the sea. Coral-stone walls, deep shaded terraces and a long shared pool keep the public edge of the building cool and open.',
      note: 'Thirty residences · Three and four bedroom layouts · Direct sea access',
      hero: KSA + 'red-sea-horizon.jpg',
      heroAlt: 'Red Sea Horizon — coral-stone waterfront residences with an infinity pool at dusk',
      heroCap: 'Jeddah · The north shore',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Red Sea Horizon masterplan, aerial view along the shore',
      gallery: [
        { img: KSA + 'red-sea-horizon.jpg', cap: 'Exterior', sub: 'The sea edge' },
        { img: IMG + 'g-lounge.jpg', cap: 'Living room', sub: 'Sea light' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Coral stone' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Water outlook' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool', sub: 'Shared terrace' },
        { img: KSA + 'lm-jeddah.jpg', cap: 'The city', sub: 'Jeddah Corniche' }
      ],
      amenities: ['Direct Sea Access', 'Long Shared Pool', 'Private Beach Cabanas', 'Wellness Suite', 'Residents’ Dining Room', 'Covered Parking', '24/7 Concierge', 'Landscaped Terraces'],
      layouts: [
        { name: 'Sea Residence', plan: IMG + 'plan-3.png', type: 'Three bedroom', size: '2,800 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Sea terrace', pool: 'Shared', availability: 'Available' },
        { name: 'Horizon Residence', plan: IMG + 'plan-2.png', type: 'Four bedroom', size: '3,600 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Sea terrace', pool: 'Shared', availability: 'Last Units' },
        { name: 'Coral Residence', plan: IMG + 'plan-1.png', type: 'Four bedroom', size: '4,100 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Corner terrace', pool: 'Private', availability: 'Available' }
      ],
      landmarks: [
        { name: 'Jeddah Corniche', img: KSA + 'lm-jeddah.jpg', min: 12, km: '10 km' },
        { name: 'King Abdulaziz International Airport', img: KSA + 'lm-jeddah.jpg', min: 25, km: '28 km' },
        { name: 'Al-Balad, historic Jeddah', img: KSA + 'lm-jeddah.jpg', min: 20, km: '16 km' },
        { name: 'Red Sea Mall', img: KSA + 'lm-jeddah.jpg', min: 15, km: '12 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Jeddah Prep and Grammar School', km: '6.8 km', min: '11 min' },
          { name: 'Continental School', km: '7.9 km', min: '13 min' },
          { name: 'Al Falah International School', km: '11.2 km', min: '18 min' }
        ],
        'Healthcare': [
          { name: 'Saudi German Hospital', km: '8.2 km', min: '14 min' },
          { name: 'Dr Soliman Fakeeh Hospital', km: '12.4 km', min: '19 min' }
        ],
        'Groceries': [
          { name: 'Red Sea Mall', km: '12.0 km', min: '15 min' },
          { name: 'Danube North Beach', km: '3.4 km', min: '7 min' },
          { name: 'Bin Dawood Corniche', km: '10.8 km', min: '17 min' }
        ],
        'Leisure': [
          { name: 'North Corniche Park', km: '4.1 km', min: '8 min' },
          { name: 'Jeddah Yacht Club', km: '6.5 km', min: '12 min' },
          { name: 'King Fahd Fountain', km: '13.0 km', min: '20 min' }
        ]
      },
      faqDiff: 'Every residence looks straight at the sea, with a long shared pool between the house and the water.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. The terraces are private and the beach frontage is shared and pet-friendly.',
      schools: 'Several international schools are within a 20-minute drive. Our Jeddah team can share the full list.'
    },

    'luxurious-villas': {
      name: 'Luxurious Villas',
      short: 'Luxurious',
      location: 'Emirates Hills, Dubai',
      city: 'Dubai',
      country: 'Dubai',
      status: 'Completed',
      type: 'Villa',
      handover: 'Delivered 2021',
      size: '9,000 – 12,500 sq. ft.',
      beds: '5 – 6 bedrooms',
      price: 12800000,
      currency: 'AED',
      lat: 25.0650, lon: 55.1700,
      progress: 100,
      plan: [['100%', 'Delivered'], ['—', 'Title deed issued']],
      overview: 'Four houses on the lake side of Emirates Hills, each built around a shaded inner court with the golf course and the Dubai skyline beyond. Solid stone walls, deep reveals and a long axis from the gate to the water make the houses feel older than they are.',
      note: 'Four villas · Five and six bedroom layouts · Golf-course frontage',
      hero: IMG + 'hero.jpg',
      heroAlt: 'Luxurious Villas — a limestone villa with deep loggias above the Emirates Hills golf course',
      heroCap: 'Emirates Hills · The lake side',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Luxurious Villas masterplan, aerial view over the golf course',
      gallery: [
        { img: IMG + 'hero.jpg', cap: 'Exterior', sub: 'Golf-course elevation' },
        { img: IMG + 'g-lounge.jpg', cap: 'Living room', sub: 'Double height' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master suite', sub: 'Lake outlook' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool', sub: 'Private garden' },
        { img: IMG + 'g-reading.jpg', cap: 'Library', sub: 'Garden light' }
      ],
      amenities: ['Private Pool', 'Golf-Course Frontage', 'Walled Garden', 'Home Cinema', 'Staff Quarters', 'Four-Car Garage', 'Smart Home', '24/7 Security'],
      layouts: [
        { name: 'Lake Villa', plan: IMG + 'plan-1.png', type: 'Five bedroom', size: '9,000 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Terrace', pool: 'Private', availability: 'Sold' },
        { name: 'Golf Villa', plan: IMG + 'plan-2.png', type: 'Six bedroom', size: '12,500 sq.ft', bedrooms: '6', bathrooms: '7', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' }
      ],
      landmarks: [
        { name: 'Dubai Marina', img: IMG + 'lm-marina.jpg', min: 12, km: '8 km' },
        { name: 'Burj Al Arab', img: IMG + 'lm-burj-al-arab.jpg', min: 15, km: '11 km' },
        { name: 'Downtown Dubai', img: IMG + 'lm-burj-khalifa.jpg', min: 20, km: '16 km' },
        { name: 'Dubai International Airport', img: IMG + 'lm-airport.jpg', min: 25, km: '24 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Dubai British School Emirates Hills', km: '2.8 km', min: '6 min' },
          { name: 'Regent International School', km: '4.1 km', min: '8 min' },
          { name: 'GEMS Dubai American Academy', km: '6.2 km', min: '10 min' }
        ],
        'Healthcare': [
          { name: 'Mediclinic Al Sufouh', km: '5.4 km', min: '9 min' },
          { name: 'King’s College Hospital Dubai', km: '10.2 km', min: '15 min' }
        ],
        'Groceries': [
          { name: 'Waitrose Emirates Hills', km: '1.6 km', min: '4 min' },
          { name: 'Mall of the Emirates', km: '6.8 km', min: '11 min' },
          { name: 'Dubai Marina Mall', km: '7.4 km', min: '11 min' }
        ],
        'Leisure': [
          { name: 'Emirates Golf Club', km: '0.9 km', min: '3 min' },
          { name: 'Montgomerie Golf Club', km: '1.8 km', min: '4 min' },
          { name: 'Al Sufouh Beach', km: '6.0 km', min: '10 min' }
        ]
      },
      faqDiff: 'A walled lake-side garden, a long stone axis through the house and the golf course at the end of it.',
      payment: 'Residences are complete; title deed issued on transfer.',
      pets: 'Yes. Every villa has a walled garden and direct access to the lake walk.',
      schools: 'Several international schools are within a 10-minute drive. Our team can share the full list on request.'
    },

    'skyline-towers': {
      name: 'Skyline Towers',
      short: 'Skyline',
      location: 'Business Bay, Dubai',
      city: 'Dubai',
      country: 'Dubai',
      status: 'Ongoing',
      type: 'Apartments',
      handover: 'Q3 2027',
      size: '720 – 2,150 sq. ft.',
      beds: '1 – 3 bedrooms',
      price: 1650000,
      currency: 'AED',
      lat: 25.1850, lon: 55.2650,
      progress: 68,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'Two slender towers on the canal in Business Bay, set back behind a shaded public colonnade. Apartments are planned from the corner inward, so every living room has two aspects and a balcony deep enough to sit out in. The towers share a garden podium and a residents’ club on the eighth floor.',
      note: 'Two towers · 214 apartments · One to three bedroom layouts',
      hero: 'assets/project-3.jpg',
      heroAlt: 'Skyline Towers — stepped pale stone and bronze towers above the Business Bay canal',
      heroCap: 'Business Bay · The canal front',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Skyline Towers masterplan, aerial view of the podium and towers',
      gallery: [
        { img: 'assets/project-3.jpg', cap: 'Exterior', sub: 'The canal front' },
        { img: IMG + 'g-lounge.jpg', cap: 'Living room', sub: 'Corner aspect' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Bedroom', sub: 'Canal view' },
        { img: IMG + 'g-pool.jpg', cap: 'Podium pool', sub: 'Eighth floor' },
        { img: IMG + 'g-street.jpg', cap: 'The colonnade', sub: 'Canal walk' }
      ],
      amenities: ['Podium Garden', 'Residents’ Club', '25 m Pool', 'Fitness Studio', 'Canal Promenade', 'Concierge', 'Covered Parking', '24/7 Security'],
      layouts: [
        { name: 'One Bedroom', plan: IMG + 'plan-4.png', type: 'One bedroom', size: '720 sq.ft', bedrooms: '1', bathrooms: '2', balcony: 'Loggia', pool: 'Shared', availability: 'Available' },
        { name: 'Two Bedroom', plan: IMG + 'plan-3.png', type: 'Two bedroom', size: '1,180 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Balcony', pool: 'Shared', availability: 'Available' },
        { name: 'Corner Two Bedroom', plan: IMG + 'plan-2.png', type: 'Two bedroom', size: '1,460 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Corner loggia', pool: 'Shared', availability: 'Last Units' },
        { name: 'Three Bedroom', plan: IMG + 'plan-1.png', type: 'Three bedroom', size: '2,150 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Terrace', pool: 'Shared', availability: 'Sold' }
      ],
      landmarks: [
        { name: 'Downtown Dubai', img: IMG + 'lm-burj-khalifa.jpg', min: 8, km: '4 km' },
        { name: 'Dubai International Airport', img: IMG + 'lm-airport.jpg', min: 18, km: '15 km' },
        { name: 'Dubai Marina', img: IMG + 'lm-marina.jpg', min: 22, km: '20 km' },
        { name: 'Palm Jumeirah', img: IMG + 'lm-beach.jpg', min: 25, km: '24 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'GEMS Wellington Primary', km: '2.6 km', min: '6 min' },
          { name: 'Jumeirah Primary School', km: '7.4 km', min: '12 min' },
          { name: 'Dubai International Academy', km: '9.8 km', min: '15 min' }
        ],
        'Healthcare': [
          { name: 'Mediclinic Business Bay', km: '1.4 km', min: '4 min' },
          { name: 'Rashid Hospital', km: '6.2 km', min: '10 min' }
        ],
        'Groceries': [
          { name: 'Bay Avenue Mall', km: '0.8 km', min: '3 min' },
          { name: 'Spinneys Business Bay', km: '1.1 km', min: '4 min' },
          { name: 'Dubai Mall', km: '3.6 km', min: '8 min' }
        ],
        'Leisure': [
          { name: 'Dubai Water Canal', km: '0.2 km', min: '2 min' },
          { name: 'Burj Park', km: '3.1 km', min: '7 min' },
          { name: 'Safa Park', km: '4.8 km', min: '9 min' }
        ]
      },
      faqDiff: 'Two aspects and a deep loggia in every apartment, on a quiet stretch of the canal walk.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. The podium garden includes a fenced pet run and washing point.',
      schools: 'Several international schools are within a 15-minute drive. Our team can share the full list on request.'
    },

    'palm-crest-villas': {
      name: 'Palm Crest Villas',
      short: 'Palm Crest',
      location: 'Palm Jumeirah, Dubai',
      city: 'Dubai',
      country: 'Dubai',
      status: 'Upcoming',
      type: 'Villa',
      handover: 'Q2 2029',
      size: '5,800 – 7,400 sq. ft.',
      beds: '4 – 5 bedrooms',
      price: 22000000,
      currency: 'AED',
      lat: 25.1250, lon: 55.1250,
      progress: 8,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'A last row of eight beach villas on the outer frond, planned around a double-height sea room and a walled garden that holds the pool. The architecture is quiet — limestone, bronze and a deep roof — so the water does the talking.',
      note: 'Eight villas · Four and five bedroom layouts · 24 m of private beach each',
      hero: 'assets/project-4.jpg',
      heroAlt: 'Palm Crest Villas — a stone and timber beach house glowing at blue hour behind planting',
      heroCap: 'Palm Jumeirah · The outer frond',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Palm Crest Villas masterplan, aerial view of the outer frond',
      gallery: [
        { img: 'assets/project-4.jpg', cap: 'Exterior', sub: 'Blue hour' },
        { img: IMG + 'g-lounge.jpg', cap: 'Sea room', sub: 'Double height' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Sea outlook' },
        { img: IMG + 'g-pool.jpg', cap: 'Pool', sub: 'Walled garden' },
        { img: KSA + 'sun-bliss-residence.jpg', cap: 'The beach', sub: 'Private frontage' }
      ],
      amenities: ['24 m Private Beach', 'Walled Garden', 'Infinity Pool', 'Sea Room', 'Staff Quarters', 'Beach Club Access', 'Covered Parking', '24/7 Security'],
      layouts: [
        { name: 'Crest Villa', plan: IMG + 'plan-3.png', type: 'Four bedroom', size: '5,800 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Sea terrace', pool: 'Private', availability: 'Available' },
        { name: 'Grand Crest Villa', plan: IMG + 'plan-1.png', type: 'Five bedroom', size: '7,400 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' }
      ],
      landmarks: [
        { name: 'Dubai Marina', img: IMG + 'lm-marina.jpg', min: 12, km: '8 km' },
        { name: 'Burj Al Arab', img: IMG + 'lm-burj-al-arab.jpg', min: 15, km: '11 km' },
        { name: 'Downtown Dubai', img: IMG + 'lm-burj-khalifa.jpg', min: 22, km: '17 km' },
        { name: 'Dubai International Airport', img: IMG + 'lm-airport.jpg', min: 27, km: '25 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Dubai British School Emirates Hills', km: '8.8 km', min: '13 min' },
          { name: 'GEMS Dubai American Academy', km: '10.6 km', min: '16 min' }
        ],
        'Healthcare': [
          { name: 'Mediclinic Al Sufouh', km: '7.2 km', min: '11 min' },
          { name: 'King’s College Hospital Dubai', km: '12.4 km', min: '17 min' }
        ],
        'Groceries': [
          { name: 'Nakheel Mall', km: '3.1 km', min: '7 min' },
          { name: 'Spinneys Palm Jumeirah', km: '2.6 km', min: '6 min' }
        ],
        'Leisure': [
          { name: 'Palm West Beach', km: '0.6 km', min: '2 min' },
          { name: 'Palm Jumeirah Boardwalk', km: '1.8 km', min: '5 min' },
          { name: 'Atlantis Aquaventure', km: '4.4 km', min: '10 min' }
        ]
      },
      faqDiff: 'A last-row beach villa with a walled garden, a double-height sea room and 24 metres of private sand.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. The garden is walled and the beach frontage is private.',
      schools: 'Several international schools are within a 20-minute drive. Our team can share the full list on request.'
    },

    'wadi-alula-residences': {
      name: 'Wadi AlUla Residences',
      short: 'Wadi AlUla',
      location: 'AlUla, Saudi Arabia',
      city: 'AlUla',
      country: 'Saudi Arabia',
      status: 'Upcoming',
      type: 'Villas & lodges',
      handover: 'Q4 2029',
      size: '2,200 – 3,600 sq. ft.',
      beds: '2 – 4 bedrooms',
      price: 3900000,
      currency: 'SAR',
      lat: 26.6100, lon: 37.9200,
      progress: 5,
      plan: [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']],
      overview: 'A low settlement of stone lodges in the sandstone wadi north of AlUla, planned so that no roof rises above the rock line. Walls are built from stone taken within the site, and each lodge opens onto a shaded terrace with a plunge pool and a view of the escarpment.',
      note: 'Twenty-two lodges · Two to four bedroom layouts · Wadi and escarpment views',
      hero: IMG + 'ex-2.jpg',
      heroAlt: 'Wadi AlUla Residences — a low white-stone house on a desert site with cactus planting',
      heroCap: 'AlUla · The wadi',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Wadi AlUla Residences masterplan, aerial view across the wadi',
      gallery: [
        { img: IMG + 'ex-2.jpg', cap: 'Exterior', sub: 'The wadi floor' },
        { img: IMG + 'g-lounge.jpg', cap: 'Living room', sub: 'Stone & linen' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Local stone' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Bedroom', sub: 'Escarpment view' },
        { img: IMG + 'g-pool.jpg', cap: 'Plunge pool', sub: 'Private terrace' },
        { img: KSA + 'lm-alula.jpg', cap: 'The region', sub: 'Hegra' }
      ],
      amenities: ['Private Plunge Pools', 'Stone Terraces', 'Desert Garden', 'Wellness Pavilion', 'Star-Gazing Deck', 'Covered Parking', '24/7 Concierge', 'Guided Wadi Walks'],
      layouts: [
        { name: 'Wadi Lodge', plan: IMG + 'plan-4.png', type: 'Two bedroom', size: '2,200 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Terrace', pool: 'Plunge', availability: 'Available' },
        { name: 'Escarpment Lodge', plan: IMG + 'plan-3.png', type: 'Three bedroom', size: '2,900 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Terrace', pool: 'Plunge', availability: 'Available' },
        { name: 'Rock House', plan: IMG + 'plan-2.png', type: 'Four bedroom', size: '3,600 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' }
      ],
      landmarks: [
        { name: 'Hegra', img: KSA + 'lm-alula.jpg', min: 30, km: '32 km' },
        { name: 'AlUla Old Town', img: KSA + 'lm-alula.jpg', min: 15, km: '14 km' },
        { name: 'Elephant Rock', img: KSA + 'lm-alula.jpg', min: 20, km: '22 km' },
        { name: 'AlUla International Airport', img: KSA + 'lm-alula.jpg', min: 25, km: '28 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'AlUla International School', km: '12.4 km', min: '16 min' }
        ],
        'Healthcare': [
          { name: 'AlUla General Hospital', km: '13.6 km', min: '18 min' }
        ],
        'Groceries': [
          { name: 'AlUla Old Town market', km: '13.8 km', min: '18 min' },
          { name: 'Winter Park retail', km: '11.2 km', min: '15 min' }
        ],
        'Leisure': [
          { name: 'AlUla Oasis', km: '12.0 km', min: '16 min' },
          { name: 'Maraya', km: '18.4 km', min: '22 min' },
          { name: 'Dadan', km: '20.6 km', min: '24 min' }
        ]
      },
      faqDiff: 'No roof above the rock line, stone from the site, and a plunge pool facing the escarpment.',
      payment: '10% on booking, 50% during construction and 40% on handover.',
      pets: 'Yes. Each lodge has a walled desert garden.',
      schools: 'AlUla International School is within a 20-minute drive; our team can share the full list.'
    },

    'al-nakheel-house': {
      name: 'Al Nakheel House',
      short: 'Al Nakheel',
      location: 'Riyadh, Saudi Arabia',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      status: 'Completed',
      type: 'Private residences',
      handover: 'Delivered 2022',
      size: '5,400 – 7,000 sq. ft.',
      beds: '4 – 5 bedrooms',
      price: 9400000,
      currency: 'SAR',
      lat: 24.7700, lon: 46.6400,
      progress: 100,
      plan: [['100%', 'Delivered'], ['—', 'Title deed issued']],
      overview: 'A cluster of six courtyard houses in the palm country of north Riyadh, built for a family that wanted the old house back: thick walls, a deep shaded court, a majlis that opens to the garden and a roof terrace for the cool months. Stone, lime and palm timber, nothing else.',
      note: 'Six courtyard houses · Four and five bedroom layouts · Mature palm gardens',
      hero: 'assets/project-1.jpg',
      heroAlt: 'Al Nakheel House — a travertine courtyard with a still pool and a single palm in warm light',
      heroCap: 'Riyadh · The palm country',
      masterplan: IMG + 'masterplan.jpg',
      masterplanAlt: 'Al Nakheel House masterplan, aerial view of the courtyard cluster',
      gallery: [
        { img: 'assets/project-1.jpg', cap: 'Courtyard', sub: 'The still pool' },
        { img: IMG + 'g-lounge.jpg', cap: 'Majlis', sub: 'Garden light' },
        { img: IMG + 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & palm timber' },
        { img: IMG + 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Courtyard outlook' },
        { img: IMG + 'g-reading.jpg', cap: 'Study', sub: 'North light' },
        { img: KSA + 'lm-riyadh.jpg', cap: 'The city', sub: 'Riyadh' }
      ],
      amenities: ['Walled Courtyards', 'Majlis & Guest Wing', 'Palm Gardens', 'Private Pool', 'Roof Terrace', 'Staff Quarters', 'Covered Parking', '24/7 Security'],
      layouts: [
        { name: 'Courtyard House', plan: IMG + 'plan-2.png', type: 'Four bedroom', size: '5,400 sq.ft', bedrooms: '4', bathrooms: '5', balcony: 'Roof terrace', pool: 'Private', availability: 'Sold' },
        { name: 'Palm House', plan: IMG + 'plan-1.png', type: 'Five bedroom', size: '7,000 sq.ft', bedrooms: '5', bathrooms: '6', balcony: 'Roof terrace', pool: 'Private', availability: 'Last Units' }
      ],
      landmarks: [
        { name: 'Downtown Riyadh', img: KSA + 'lm-riyadh.jpg', min: 10, km: '8 km' },
        { name: 'KAFD, Riyadh', img: KSA + 'lm-riyadh.jpg', min: 20, km: '18 km' },
        { name: 'King Khalid International Airport', img: KSA + 'lm-riyadh.jpg', min: 35, km: '40 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Alfaisal International Academy', km: '4.8 km', min: '9 min' },
          { name: 'King’s College Riyadh', km: '7.6 km', min: '13 min' }
        ],
        'Healthcare': [
          { name: 'Dr Sulaiman Al Habib, Olaya', km: '6.4 km', min: '11 min' },
          { name: 'King Faisal Specialist Hospital', km: '9.2 km', min: '15 min' }
        ],
        'Groceries': [
          { name: 'Panorama Mall', km: '3.8 km', min: '8 min' },
          { name: 'Tamimi Al Nakheel', km: '1.4 km', min: '4 min' }
        ],
        'Leisure': [
          { name: 'Wadi Hanifah trails', km: '5.2 km', min: '9 min' },
          { name: 'Riyadh Zoo', km: '6.8 km', min: '12 min' },
          { name: 'Salam Park', km: '7.4 km', min: '13 min' }
        ]
      },
      faqDiff: 'A deep shaded courtyard, a majlis that opens to the garden and a roof terrace for Riyadh’s cool months.',
      payment: 'Residences are complete; title deed issued on transfer.',
      pets: 'Yes. Each house has a walled palm garden.',
      schools: 'Several international schools are within a 15-minute drive. Our Riyadh team can share the full list.'
    }
  };

  var ORDER = [
    'arbour-townhomes',
    'diriyah-courtyard-villas',
    'sun-bliss-residence',
    'red-sea-horizon',
    'skyline-towers',
    'palm-crest-villas',
    'luxurious-villas',
    'wadi-alula-residences',
    'al-nakheel-house'
  ];

  var FX = { AED: 1, SAR: 1, USD: 0.2723 };
  FX.SAR = 0.2666;

  function priceIn(p, currency) {
    var usd = p.currency === 'AED' ? p.price * 0.2723 : p.price * 0.2666;
    if (currency === 'AED') return usd / 0.2723;
    if (currency === 'SAR') return usd / 0.2666;
    return usd;
  }

  function money(p, currency) {
    var v = priceIn(p, currency || p.currency);
    var prefix = currency === 'USD' ? '$' : (currency || p.currency) + ' ';
    if (v >= 1000000) return prefix + (v / 1000000).toFixed(v >= 10000000 ? 1 : 2).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return prefix + Math.round(v / 1000) + 'K';
    return prefix + Math.round(v);
  }

  window.SHADE_PROJECTS = PROJECTS;
  window.SHADE_ORDER = ORDER;
  window.SHADE_FX = FX;
  window.shadeMoney = money;
})();
