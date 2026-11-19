/* ============================================================
   SHADESTATE — Project details
   Data + rendering + interactions. No dependencies.
   Project is chosen with ?project=<slug>, default arbour-townhomes.
   ============================================================ */
(function () {
  'use strict';

  /* ───────────────────────── data ───────────────────────── */

  var IMG = 'assets/img/';

  function faqs(p) {
    return [
      { q: 'What makes ' + p.name + ' different?', a: p.faqDiff },
      { q: 'What is the payment plan?', a: p.payment },
      { q: 'Are pets allowed?', a: p.pets || 'Yes. The community is pet-friendly, with planted verges and shaded walking routes.' },
      { q: 'Which schools are nearby?', a: p.schools || 'Several international schools are within a short drive. Our team can share the full list and catchment details on request.' },
      { q: 'When is handover?', a: 'Handover is planned for ' + p.handover + ', with phased completion by cluster. A written schedule is issued with the reservation form.' },
      { q: 'How do I book a site visit?', a: 'Use the enquiry form on this page and our team will call you to arrange a visit at a time that suits you.' }
    ];
  }

  var PROJECTS = {

    'arbour-townhomes': {
      name: 'Arbour Townhomes',
      short: 'Arbour',
      location: 'Dubai Hills, Dubai',
      city: 'Dubai',
      status: 'New launch',
      type: 'Townhouse',
      handover: 'Q4 2028',
      size: '760 – 1480 sq. ft.',
      price: 'AED 2.45M',
      currency: 'AED',
      overview: 'Arbour is a collection of garden townhomes set among mature ghaf trees in Dubai Hills. Limestone façades, deep loggias and shaded walkways keep the streets cool; behind them, homes open onto private courtyards and a shared spine of green.',
      note: 'Eight townhomes in phase one · Three and four bedroom layouts · Private gardens',
      hero: 'hero.jpg',
      heroAlt: 'Arbour Townhomes — pale limestone façade behind a mature tree',
      heroCap: 'Dubai Hills · Phase one',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Arbour Townhomes masterplan, aerial view',
      gallery: [
        { img: 'hero.jpg', cap: 'Exterior', sub: 'Street elevation' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Double height' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Oak & stone' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Garden outlook' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Shared courtyard' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Podium level', size: '18,400 sq.ft', bedrooms: '–', bathrooms: '–', balcony: 'Pool deck', pool: 'Shared' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '1,150 sq.ft', bedrooms: '3', bathrooms: '3', balcony: 'Terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Garden flat', size: '760 sq.ft', bedrooms: '1', bathrooms: '2', balcony: 'Courtyard', pool: 'Shared' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Townhome', size: '1,180 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Garden', pool: '—' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Townhome', size: '2,100 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Garden', pool: 'Plunge' }
      ],
      landmarks: [
        { name: 'Jumeirah Beach', img: 'lm-beach.jpg', min: 11, km: '11 km' },
        { name: 'Burj Al Arab', img: 'lm-burj-al-arab.jpg', min: 11, km: '10 km' },
        { name: 'Burj Khalifa', img: 'lm-burj-khalifa.jpg', min: 14, km: '15 km' },
        { name: 'Dubai Marina', img: 'lm-marina.jpg', min: 14, km: '15 km' },
        { name: 'Al Maktoum Airport', img: 'lm-airport.jpg', min: 25, km: '29 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'GEMS Wellington Academy', km: '4.3 km', min: '8 min' },
          { name: 'Dubai Heights Academy', km: '3.6 km', min: '7 min' },
          { name: 'Foremarke School', km: '2.5 km', min: '5 min' }
        ],
        'Daily needs': [
          { name: 'Dubai Hills Mall', km: '1.2 km', min: '4 min' },
          { name: 'City Centre Al Barsha', km: '4.0 km', min: '8 min' },
          { name: 'Mall of the Emirates', km: '7.0 km', min: '12 min' }
        ],
        'Healthcare': [
          { name: 'King’s College Hospital Dubai', km: '2.7 km', min: '6 min' },
          { name: 'Mediclinic Parkview Hospital', km: '4.6 km', min: '8 min' }
        ],
        'Leisure': [
          { name: 'Dubai Hills Park', km: '1.6 km', min: '4 min' },
          { name: 'Al Barsha Pond Park', km: '5.9 km', min: '10 min' },
          { name: 'Dubai Miracle Garden', km: '5.4 km', min: '10 min' }
        ]
      },
      faqDiff: 'Tree-lined streets, shaded walkways and homes that open onto shared green courtyards.',
      payment: '15% on booking, 45% during construction and 40% on handover.',
      pets: 'Yes. The community is pet-friendly, with dog-walking trails and a fenced pet park.',
      schools: 'Several international schools are within a 10-minute drive. Our team can share the full list on request.'
    },

    'sun-bliss-residence': {
      name: 'Sun-Bliss Residence',
      short: 'Sun-Bliss',
      location: 'Al Furjan, Dubai',
      city: 'Dubai',
      status: 'New launch',
      type: 'Villa',
      handover: 'Q2 2027',
      size: '3,200 – 3,900 sq. ft.',
      price: 'AED 4.10M',
      currency: 'AED',
      overview: 'A low, horizontal house arranged around a north-facing courtyard, so every principal room takes its light from the shaded side and its view from the garden. Deep overhangs and a screen of planting keep the terrace usable through the summer.',
      note: 'Six villas · Four and five bedrooms · Private pools',
      hero: 'ex-1.jpg',
      heroAlt: 'Sun-Bliss Residence — white courtyard villa under a clear sky',
      heroCap: 'Al Furjan · Six villas',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Sun-Bliss Residence masterplan aerial view',
      gallery: [
        { img: 'ex-1.jpg', cap: 'Exterior', sub: 'Courtyard elevation' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'North light' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Garden outlook' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Private pool' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '2,400 sq.ft', bedrooms: '–', bathrooms: '1', balcony: 'Courtyard', pool: 'Private' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '1,500 sq.ft', bedrooms: '4', bathrooms: '4', balcony: 'Terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Garden suite', size: '820 sq.ft', bedrooms: '1', bathrooms: '2', balcony: 'Garden', pool: 'Shared' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Family villa', size: '3,200 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Terrace', pool: 'Private' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Family villa', size: '3,900 sq.ft', bedrooms: '3', bathrooms: '4', balcony: 'Garden', pool: 'Private' }
      ],
      landmarks: [
        { name: 'Jumeirah Beach', img: 'lm-beach.jpg', min: 16, km: '18 km' },
        { name: 'Burj Al Arab', img: 'lm-burj-al-arab.jpg', min: 20, km: '22 km' },
        { name: 'Burj Khalifa', img: 'lm-burj-khalifa.jpg', min: 24, km: '26 km' },
        { name: 'Dubai Marina', img: 'lm-marina.jpg', min: 18, km: '19 km' },
        { name: 'Al Maktoum Airport', img: 'lm-airport.jpg', min: 30, km: '34 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'The Arbor School', km: '3.1 km', min: '6 min' },
          { name: 'Jebel Ali School', km: '5.4 km', min: '9 min' },
          { name: 'Dubai British School', km: '6.8 km', min: '11 min' }
        ],
        'Daily needs': [
          { name: 'Al Furjan Pavilion', km: '1.0 km', min: '3 min' },
          { name: 'Ibn Battuta Mall', km: '5.1 km', min: '9 min' },
          { name: 'Festival Plaza', km: '6.4 km', min: '11 min' }
        ],
        'Healthcare': [
          { name: 'Aster Clinic Al Furjan', km: '0.9 km', min: '3 min' },
          { name: 'Mediclinic Ibn Battuta', km: '4.8 km', min: '9 min' }
        ],
        'Leisure': [
          { name: 'Al Furjan Park', km: '1.3 km', min: '4 min' },
          { name: 'JBR Beach', km: '15.2 km', min: '18 min' },
          { name: 'The Els Club', km: '8.3 km', min: '14 min' }
        ]
      },
      faqDiff: 'A courtyard plan that faces its living rooms north, away from the afternoon sun, with the garden wrapped on three sides.',
      payment: '20% on booking, 50% during construction and 30% on handover.',
      schools: 'The Arbor School and Jebel Ali School are both within ten minutes by car.'
    },

    'townhouse': {
      name: 'Townhouse',
      short: 'Townhouse',
      location: 'JVC, Dubai',
      city: 'Dubai',
      status: 'Ready',
      type: 'Townhouse',
      handover: 'Q1 2026',
      size: '1,450 – 1,900 sq. ft.',
      price: 'AED 1.85M',
      currency: 'AED',
      overview: 'A terrace of twelve townhouses on a quiet street in JVC, planned so that every home has a double-aspect living floor, a small walled garden and parking at the door. Materials are plain and durable: fair-faced block, ash joinery, terrazzo.',
      note: 'Twelve townhouses · Ready to move in · Three bedrooms as standard',
      hero: 'ex-2.jpg',
      heroAlt: 'Townhouse — a low white residence behind a gravel forecourt',
      heroCap: 'JVC · Twelve homes',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Townhouse community masterplan',
      gallery: [
        { img: 'ex-2.jpg', cap: 'Exterior', sub: 'Street elevation' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Double aspect' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Ash & terrazzo' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Garden outlook' },
        { img: 'g-street.jpg', cap: 'Terrace', sub: 'Walled garden' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '780 sq.ft', bedrooms: '–', bathrooms: '1', balcony: 'Garden', pool: '—' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '670 sq.ft', bedrooms: '3', bathrooms: '2', balcony: 'Balcony', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Garden flat', size: '640 sq.ft', bedrooms: '1', bathrooms: '1', balcony: 'Garden', pool: '—' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Townhouse', size: '1,450 sq.ft', bedrooms: '2', bathrooms: '3', balcony: 'Garden', pool: '—' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Townhouse', size: '1,900 sq.ft', bedrooms: '3', bathrooms: '3', balcony: 'Roof terrace', pool: '—' }
      ],
      landmarks: [
        { name: 'Jumeirah Beach', img: 'lm-beach.jpg', min: 22, km: '24 km' },
        { name: 'Burj Al Arab', img: 'lm-burj-al-arab.jpg', min: 24, km: '25 km' },
        { name: 'Burj Khalifa', img: 'lm-burj-khalifa.jpg', min: 25, km: '28 km' },
        { name: 'Dubai Marina', img: 'lm-marina.jpg', min: 18, km: '20 km' },
        { name: 'Al Maktoum Airport', img: 'lm-airport.jpg', min: 28, km: '32 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'JSS International School', km: '1.8 km', min: '5 min' },
          { name: 'Sunmarke School', km: '3.2 km', min: '7 min' },
          { name: 'GEMS Metropole', km: '4.6 km', min: '9 min' }
        ],
        'Daily needs': [
          { name: 'Circle Mall JVC', km: '1.4 km', min: '4 min' },
          { name: 'Al Khail Gate Retail', km: '3.0 km', min: '7 min' },
          { name: 'Mall of the Emirates', km: '10.2 km', min: '15 min' }
        ],
        'Healthcare': [
          { name: 'Aster Clinic JVC', km: '0.8 km', min: '3 min' },
          { name: 'Mediclinic Dubai Hills', km: '6.1 km', min: '11 min' }
        ],
        'Leisure': [
          { name: 'JVC Community Park', km: '1.1 km', min: '4 min' },
          { name: 'Dubai Miracle Garden', km: '5.0 km', min: '9 min' },
          { name: 'Sports City', km: '4.2 km', min: '8 min' }
        ]
      },
      faqDiff: 'Every home has a double-aspect living floor and its own front door onto the street, with parking at the threshold.',
      payment: '10% on booking, 60% during construction and 30% on handover.',
      schools: 'JSS International and Sunmarke are both within ten minutes.'
    },

    'luxurious-villas': {
      name: 'Luxurious Villas',
      short: 'Luxurious Villas',
      location: 'Palm Jumeirah, Dubai',
      city: 'Dubai',
      status: 'Limited release',
      type: 'Villa',
      handover: 'Q4 2027',
      size: '5,600 – 7,200 sq. ft.',
      price: 'AED 12.50M',
      currency: 'AED',
      overview: 'Four beachfront villas on the outer frond, each with a private stretch of sand, a shaded majlis and a pool that runs the width of the terrace. The architecture is quiet — travertine, lime plaster, bronze — so the water does the talking.',
      note: 'Four villas · Five bedrooms · Private beach frontage',
      hero: 'ex-3.jpg',
      heroAlt: 'Luxurious Villas — a white villa with arched entrance and olive trees',
      heroCap: 'Palm Jumeirah · Outer frond',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Luxurious Villas masterplan',
      gallery: [
        { img: 'ex-3.jpg', cap: 'Exterior', sub: 'Arrival court' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Sea aspect' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Lime plaster' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Beach frontage' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Private pool' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Beach level', size: '3,900 sq.ft', bedrooms: '–', bathrooms: '1', balcony: 'Terrace', pool: 'Private' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '2,300 sq.ft', bedrooms: '5', bathrooms: '5', balcony: 'Sea terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Guest suite', size: '900 sq.ft', bedrooms: '1', bathrooms: '2', balcony: 'Courtyard', pool: 'Shared' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Garden villa', size: '5,600 sq.ft', bedrooms: '2', bathrooms: '4', balcony: 'Garden', pool: 'Private' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Beach villa', size: '7,200 sq.ft', bedrooms: '3', bathrooms: '5', balcony: 'Beach', pool: 'Private' }
      ],
      landmarks: [
        { name: 'Jumeirah Beach', img: 'lm-beach.jpg', min: 10, km: '8 km' },
        { name: 'Burj Al Arab', img: 'lm-burj-al-arab.jpg', min: 14, km: '12 km' },
        { name: 'Burj Khalifa', img: 'lm-burj-khalifa.jpg', min: 24, km: '26 km' },
        { name: 'Dubai Marina', img: 'lm-marina.jpg', min: 12, km: '10 km' },
        { name: 'Al Maktoum Airport', img: 'lm-airport.jpg', min: 38, km: '42 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Dubai College', km: '9.2 km', min: '14 min' },
          { name: 'GEMS Wellington International', km: '7.8 km', min: '12 min' },
          { name: 'Jumeirah College', km: '8.4 km', min: '13 min' }
        ],
        'Daily needs': [
          { name: 'Nakheel Mall', km: '3.1 km', min: '7 min' },
          { name: 'The Pointe', km: '2.4 km', min: '6 min' },
          { name: 'Mall of the Emirates', km: '9.6 km', min: '14 min' }
        ],
        'Healthcare': [
          { name: 'Al Das Medical Clinic', km: '2.8 km', min: '7 min' },
          { name: 'Mediclinic Al Sufouh', km: '10.1 km', min: '15 min' }
        ],
        'Leisure': [
          { name: 'Aquaventure Beach', km: '1.2 km', min: '4 min' },
          { name: 'The Palm Jogging Track', km: '1.0 km', min: '3 min' },
          { name: 'Dubai Marina Walk', km: '9.8 km', min: '14 min' }
        ]
      },
      faqDiff: 'Direct beach frontage on the outer frond, with the pool and majlis set on the water side and full privacy from the street.',
      payment: '25% on booking, 45% during construction and 30% on handover.',
      schools: 'Dubai College and GEMS Wellington International are within fifteen minutes.'
    },

    'casa-da-luz': {
      name: 'Casa da Luz',
      short: 'Casa da Luz',
      location: 'Comporta, Portugal',
      city: 'Comporta',
      status: 'Available',
      type: 'Villa',
      handover: 'Q3 2026',
      size: '412 – 486 m²',
      price: '€3.85M',
      currency: 'EUR',
      overview: 'Eight houses set back from the dunes in Comporta, built from lime mortar, chestnut and local stone. Each has a courtyard that holds the afternoon light and a covered terrace that faces the pine belt, so the house stays cool without shutting the air out.',
      note: 'Eight residences · Four and five bedrooms · Private pools',
      hero: 'ex-2.jpg',
      heroAlt: 'Casa da Luz — a white villa behind a gravel court, late afternoon',
      heroCap: 'Comporta · Eight houses',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Casa da Luz masterplan',
      gallery: [
        { img: 'ex-2.jpg', cap: 'Exterior', sub: 'Courtyard' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Afternoon light' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & chestnut' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Pine outlook' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Dune garden' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '248 m²', bedrooms: '–', bathrooms: '1', balcony: 'Courtyard', pool: 'Private' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '164 m²', bedrooms: '4', bathrooms: '3', balcony: 'Terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Garden suite', size: '68 m²', bedrooms: '1', bathrooms: '1', balcony: 'Garden', pool: 'Shared' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'House', size: '412 m²', bedrooms: '4', bathrooms: '4', balcony: 'Terrace', pool: 'Private' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'House', size: '486 m²', bedrooms: '5', bathrooms: '4', balcony: 'Pine terrace', pool: 'Private' }
      ],
      landmarks: [
        { name: 'Praia da Comporta', img: 'lm-beach.jpg', min: 12, km: '9 km' },
        { name: 'Carvalhal', img: 'lm-marina.jpg', min: 9, km: '7 km' },
        { name: 'Alcácer do Sal', img: 'lm-burj-khalifa.jpg', min: 30, km: '32 km' },
        { name: 'Troia Peninsula', img: 'lm-burj-al-arab.jpg', min: 26, km: '24 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 74, km: '118 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Escola de Comporta', km: '3.4 km', min: '7 min' },
          { name: 'Colégio de Alcácer', km: '24 km', min: '26 min' },
          { name: 'International School of Lisbon', km: '96 km', min: '70 min' }
        ],
        'Daily needs': [
          { name: 'Mercearia da Comporta', km: '2.8 km', min: '6 min' },
          { name: 'Carvalhal Market', km: '6.1 km', min: '9 min' },
          { name: 'Alcácer do Sal Shopping', km: '25 km', min: '28 min' }
        ],
        'Healthcare': [
          { name: 'Centro de Saúde de Alcácer', km: '26 km', min: '28 min' },
          { name: 'Hospital de Setúbal', km: '56 km', min: '48 min' }
        ],
        'Leisure': [
          { name: 'Praia da Comporta', km: '9.0 km', min: '12 min' },
          { name: 'Herdade da Comporta', km: '11 km', min: '15 min' },
          { name: 'Troia Golf', km: '24 km', min: '26 min' }
        ]
      },
      faqDiff: 'A courtyard plan in lime mortar and chestnut, set back from the dunes so the house holds the afternoon light without the wind.',
      payment: '30% on reservation, 30% during construction and 40% on deed.',
      pets: 'Yes. The houses have walled courtyards and there is direct access to the pine belt for walks.',
      schools: 'The village school is seven minutes away; Lisbon international schools are within an hour and a quarter.'
    },

    'alto-principe': {
      name: 'Alto Príncipe',
      short: 'Alto Príncipe',
      location: 'Príncipe Real, Lisbon',
      city: 'Lisbon',
      status: 'Upcoming',
      type: 'Apartment',
      handover: 'Q1 2027',
      size: '212 – 342 m²',
      price: '€2.95M',
      currency: 'EUR',
      overview: 'Six apartments behind a restored nineteenth-century façade on the high side of Príncipe Real. The original stone stair is kept; behind it, rooms are opened to the garden and the river light, with kitchens in oak and Estremoz marble.',
      note: 'Six apartments · Three and four bedrooms · Garden and river views',
      hero: 'ex-3.jpg',
      heroAlt: 'Alto Príncipe — restored stone façade with arched entrance',
      heroCap: 'Príncipe Real · Six apartments',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Alto Príncipe masterplan',
      gallery: [
        { img: 'ex-3.jpg', cap: 'Exterior', sub: 'Restored façade' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Double height' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Oak & marble' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'River light' },
        { img: 'g-street.jpg', cap: 'Terrace', sub: 'Roof garden' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Piano nobile', size: '186 m²', bedrooms: '–', bathrooms: '1', balcony: 'Balcony', pool: '—' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Apartment', size: '212 m²', bedrooms: '3', bathrooms: '3', balcony: 'Balcony', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Apartment', size: '96 m²', bedrooms: '1', bathrooms: '2', balcony: 'Courtyard', pool: '—' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Apartment', size: '248 m²', bedrooms: '2', bathrooms: '3', balcony: 'Terrace', pool: '—' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Garden duplex', size: '342 m²', bedrooms: '3', bathrooms: '4', balcony: 'Garden', pool: 'Plunge' }
      ],
      landmarks: [
        { name: 'Praça do Príncipe Real', img: 'lm-burj-khalifa.jpg', min: 4, km: '0.6 km' },
        { name: 'Chiado', img: 'g-street.jpg', min: 9, km: '1.8 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 22, km: '9 km' },
        { name: 'Cascais', img: 'lm-marina.jpg', min: 34, km: '30 km' },
        { name: 'Sintra', img: 'lm-beach.jpg', min: 38, km: '32 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Colégio Pedro Nunes', km: '1.2 km', min: '6 min' },
          { name: 'Escola Francesa de Lisboa', km: '3.4 km', min: '12 min' },
          { name: 'St Julian’s School', km: '12 km', min: '24 min' }
        ],
        'Daily needs': [
          { name: 'Mercado de Príncipe Real', km: '0.4 km', min: '2 min' },
          { name: 'El Corte Inglés', km: '2.1 km', min: '9 min' },
          { name: 'Chiado shops', km: '1.6 km', min: '8 min' }
        ],
        'Healthcare': [
          { name: 'Hospital da Cuf', km: '2.8 km', min: '10 min' },
          { name: 'Hospital de São José', km: '2.2 km', min: '9 min' }
        ],
        'Leisure': [
          { name: 'Jardim do Príncipe Real', km: '0.5 km', min: '3 min' },
          { name: 'Miradouro de São Pedro', km: '0.9 km', min: '5 min' },
          { name: 'Teatro Nacional', km: '1.4 km', min: '7 min' }
        ]
      },
      faqDiff: 'A restored nineteenth-century shell with the original stone stair kept intact and the living rooms opened to the garden and the river.',
      payment: '20% on reservation, 40% during works and 40% on deed.',
      pets: 'Yes. Apartments have direct lift access and the garden is shared but enclosed.',
      schools: 'Colégio Pedro Nunes is six minutes away and the French school twelve.'
    },

    'mare-residences': {
      name: 'Maré Residences',
      short: 'Maré',
      location: 'Cascais, Portugal',
      city: 'Cascais',
      status: 'Upcoming',
      type: 'Apartment',
      handover: 'Q2 2028',
      size: '128 – 186 m²',
      price: '€1.45M',
      currency: 'EUR',
      overview: 'A stepped building above the sea at Cascais, with fourteen apartments and planted terraces that step back as the building rises. Every home has an outdoor room facing the water, and the shared garden runs down to the coastal path.',
      note: 'Fourteen apartments · Two and three bedrooms · Sea-facing terraces',
      hero: 'ex-2.jpg',
      heroAlt: 'Maré Residences — a stepped stone building above the sea at dusk',
      heroCap: 'Cascais · Fourteen apartments',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Maré Residences masterplan',
      gallery: [
        { img: 'ex-2.jpg', cap: 'Exterior', sub: 'Sea elevation' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Sea light' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Stone & oak' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Terrace' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Shared garden' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '142 m²', bedrooms: '–', bathrooms: '1', balcony: 'Garden', pool: 'Shared' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Apartment', size: '128 m²', bedrooms: '2', bathrooms: '2', balcony: 'Sea terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Apartment', size: '74 m²', bedrooms: '1', bathrooms: '1', balcony: 'Balcony', pool: '—' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Apartment', size: '158 m²', bedrooms: '2', bathrooms: '2', balcony: 'Terrace', pool: 'Shared' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Penthouse', size: '186 m²', bedrooms: '3', bathrooms: '3', balcony: 'Roof terrace', pool: 'Plunge' }
      ],
      landmarks: [
        { name: 'Praia da Rainha', img: 'lm-beach.jpg', min: 6, km: '1.6 km' },
        { name: 'Cascais Marina', img: 'lm-marina.jpg', min: 8, km: '2.8 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 30, km: '34 km' },
        { name: 'Sintra', img: 'lm-burj-khalifa.jpg', min: 26, km: '22 km' },
        { name: 'Cabo da Roca', img: 'lm-burj-al-arab.jpg', min: 24, km: '18 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Escola de Cascais', km: '1.1 km', min: '5 min' },
          { name: 'St Julian’s School', km: '4.6 km', min: '10 min' },
          { name: 'Escola Alemã de Lisboa', km: '18 km', min: '22 min' }
        ],
        'Daily needs': [
          { name: 'Mercado de Cascais', km: '0.9 km', min: '4 min' },
          { name: 'Cascais Shopping', km: '3.2 km', min: '8 min' },
          { name: 'InterContinental shops', km: '1.4 km', min: '6 min' }
        ],
        'Healthcare': [
          { name: 'Hospital de Cascais', km: '4.8 km', min: '10 min' },
          { name: 'Cuf Cascais', km: '2.6 km', min: '7 min' }
        ],
        'Leisure': [
          { name: 'Praia da Conceição', km: '1.2 km', min: '5 min' },
          { name: 'Cascais Marina', km: '2.8 km', min: '8 min' },
          { name: 'Boca do Inferno', km: '3.4 km', min: '9 min' }
        ]
      },
      faqDiff: 'Every apartment has an outdoor room facing the water, and the building steps back as it rises so the terraces are never overlooked.',
      payment: '25% on reservation, 35% during works and 40% on deed.',
      pets: 'Yes. The shared garden is enclosed and the coastal path starts at the gate.',
      schools: 'St Julian’s School is ten minutes away; central Lisbon schools are within half an hour.'
    },

    'quinta-do-vale': {
      name: 'Quinta do Vale',
      short: 'Quinta do Vale',
      location: 'Alentejo, Portugal',
      city: 'Alentejo',
      status: 'Completed',
      type: 'Villa',
      handover: '2023',
      size: '364 m²',
      price: 'Sold out',
      currency: 'EUR',
      overview: 'Five houses on a working olive quinta in the Alentejo, built from rammed earth and local stone, with deep verandas on the shaded side. The estate retains its original well, outbuildings and a stand of centenarian olive trees.',
      note: 'Five residences · Four bedrooms · Completed 2023',
      hero: 'ex-1.jpg',
      heroAlt: 'Quinta do Vale — stone and timber house at blue hour behind lavender',
      heroCap: 'Alentejo · Five houses',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Quinta do Vale masterplan',
      gallery: [
        { img: 'ex-1.jpg', cap: 'Exterior', sub: 'Olive quinta' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Rammed earth' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Oak & stone' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Veranda' },
        { img: 'g-pool.jpg', cap: 'Pool deck', sub: 'Original well' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '214 m²', bedrooms: '–', bathrooms: '1', balcony: 'Veranda', pool: 'Private' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '150 m²', bedrooms: '4', bathrooms: '3', balcony: 'Veranda', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Guest house', size: '64 m²', bedrooms: '1', bathrooms: '1', balcony: 'Courtyard', pool: 'Shared' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'House', size: '298 m²', bedrooms: '4', bathrooms: '4', balcony: 'Veranda', pool: 'Private' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'House', size: '364 m²', bedrooms: '4', bathrooms: '4', balcony: 'Veranda', pool: 'Private' }
      ],
      landmarks: [
        { name: 'Évora', img: 'lm-burj-khalifa.jpg', min: 34, km: '38 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 78, km: '112 km' },
        { name: 'Comporta', img: 'lm-beach.jpg', min: 62, km: '84 km' },
        { name: 'Estremoz', img: 'lm-burj-al-arab.jpg', min: 28, km: '32 km' },
        { name: 'Montemor-o-Novo', img: 'lm-marina.jpg', min: 22, km: '24 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Escola de Montemor', km: '24 km', min: '22 min' },
          { name: 'Colégio de Évora', km: '38 km', min: '34 min' },
          { name: 'International School of Lisbon', km: '110 km', min: '75 min' }
        ],
        'Daily needs': [
          { name: 'Mercado de Montemor', km: '24 km', min: '22 min' },
          { name: 'Évora Retail Park', km: '38 km', min: '34 min' },
          { name: 'Vendas Novas market', km: '18 km', min: '18 min' }
        ],
        'Healthcare': [
          { name: 'Hospital de Évora', km: '38 km', min: '34 min' },
          { name: 'Centro de Saúde de Montemor', km: '24 km', min: '22 min' }
        ],
        'Leisure': [
          { name: 'Quinta olive walks', km: '0 km', min: '1 min' },
          { name: 'Évora old town', km: '38 km', min: '34 min' },
          { name: 'Comporta beaches', km: '84 km', min: '62 min' }
        ]
      },
      faqDiff: 'Five houses on a working olive quinta, built from rammed earth and stone, with the estate’s original well and outbuildings kept.',
      payment: 'Reservations for the completed estate are handled by the studio on request.',
      pets: 'Yes. Houses have enclosed gardens and the quinta is fenced.',
      schools: 'The village school is twenty minutes away; Évora schools are thirty-five.'
    },

    'miradouro-terrace': {
      name: 'Miradouro Terrace',
      short: 'Miradouro',
      location: 'Graça, Lisbon',
      city: 'Lisbon',
      status: 'Available',
      type: 'Penthouse',
      handover: '2025',
      size: '248 m² + 96 m² terrace',
      price: '€5.60M',
      currency: 'EUR',
      overview: 'Three penthouses above Graça, each with a roof terrace set back from the parapet so the view over the castle and the river stays uninterrupted. Interiors are pale oak, linen and Estremoz stone; the terraces have a kitchen, an outdoor room and a deep planter.',
      note: 'Three penthouses · Three bedrooms · Private roof terraces',
      hero: 'g-street.jpg',
      heroAlt: 'Miradouro Terrace — travertine terrace above the Lisbon skyline',
      heroCap: 'Graça · Three penthouses',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Miradouro Terrace masterplan',
      gallery: [
        { img: 'g-street.jpg', cap: 'Exterior', sub: 'Roof terrace' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'River view' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Oak & stone' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Castle view' },
        { img: 'g-reading.jpg', cap: 'Terrace', sub: 'Outdoor room' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Terrace level', size: '96 m²', bedrooms: '–', bathrooms: '1', balcony: 'Roof terrace', pool: 'Plunge' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Penthouse', size: '248 m²', bedrooms: '3', bathrooms: '3', balcony: 'Terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Penthouse suite', size: '112 m²', bedrooms: '1', bathrooms: '2', balcony: 'Balcony', pool: '—' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'Penthouse', size: '196 m²', bedrooms: '2', bathrooms: '2', balcony: 'Terrace', pool: '—' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'Penthouse', size: '248 m²', bedrooms: '3', bathrooms: '3', balcony: 'Roof terrace', pool: 'Plunge' }
      ],
      landmarks: [
        { name: 'Miradouro da Graça', img: 'lm-burj-khalifa.jpg', min: 4, km: '0.5 km' },
        { name: 'Castelo de São Jorge', img: 'lm-burj-al-arab.jpg', min: 8, km: '1.4 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 20, km: '8 km' },
        { name: 'Cais do Sodré', img: 'lm-marina.jpg', min: 12, km: '2.6 km' },
        { name: 'Cascais', img: 'lm-beach.jpg', min: 32, km: '28 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Escola Gil Vicente', km: '0.8 km', min: '4 min' },
          { name: 'Colégio Pedro Nunes', km: '2.6 km', min: '9 min' },
          { name: 'St Julian’s School', km: '14 km', min: '26 min' }
        ],
        'Daily needs': [
          { name: 'Mercado de Graça', km: '0.3 km', min: '2 min' },
          { name: 'El Corte Inglés', km: '4.2 km', min: '13 min' },
          { name: 'Baixa shops', km: '1.9 km', min: '9 min' }
        ],
        'Healthcare': [
          { name: 'Hospital de São José', km: '1.6 km', min: '7 min' },
          { name: 'Cuf Descobertas', km: '5.8 km', min: '15 min' }
        ],
        'Leisure': [
          { name: 'Miradouro da Graça', km: '0.5 km', min: '4 min' },
          { name: 'Feira da Ladra', km: '0.9 km', min: '5 min' },
          { name: 'Jardim da Cerca da Graça', km: '0.4 km', min: '3 min' }
        ]
      },
      faqDiff: 'The roof terraces are set back from the parapet, so the view over the castle and the river is uninterrupted and the terrace is never overlooked.',
      payment: '30% on reservation, 40% during works and 30% on deed.',
      pets: 'Yes. The private roof terrace gives each penthouse its own outdoor space.',
      schools: 'Escola Gil Vicente is four minutes away and Pedro Nunes nine.'
    },

    'shadestate-house': {
      name: 'Shadestate House',
      short: 'Shadestate House',
      location: 'Comporta, Portugal',
      city: 'Comporta',
      status: 'Completed',
      type: 'Villa',
      handover: '2019',
      size: '612 m²',
      price: 'Sold',
      currency: 'EUR',
      overview: 'The studio’s own house in Comporta, completed in 2019 and the reference for everything since: lime-rendered walls, a deep loggia, and a reflecting pool that holds the sky at the end of the courtyard.',
      note: 'One residence · Six bedrooms · Sold in 2021',
      hero: 'ex-1.jpg',
      heroAlt: 'Shadestate House — limestone villa with reflecting pool and olive trees',
      heroCap: 'Comporta · The studio house',
      masterplan: 'masterplan.jpg',
      masterplanAlt: 'Shadestate House masterplan',
      gallery: [
        { img: 'ex-1.jpg', cap: 'Exterior', sub: 'Reflecting pool' },
        { img: 'g-lounge.jpg', cap: 'Lounge', sub: 'Loggia light' },
        { img: 'g-kitchen.jpg', cap: 'Kitchen', sub: 'Lime & oak' },
        { img: 'g-bedroom.jpg', cap: 'Master bedroom', sub: 'Courtyard' },
        { img: 'g-reading.jpg', cap: 'Terrace', sub: 'Reading loggia' }
      ],
      amenities: ['Landscaped Gardens', "Children's Play Area", 'Tennis Court', 'Yoga Deck', 'State-of-the-Art Gymnasium', 'Covered Parking', '24/7 Security', 'Residents’ Lounge'],
      layouts: [
        { name: 'First Floor', plan: 'plan-1.png', type: 'Ground level', size: '360 m²', bedrooms: '–', bathrooms: '2', balcony: 'Loggia', pool: 'Private' },
        { name: 'Typical Floor', plan: 'plan-2.png', type: 'Bedroom level', size: '252 m²', bedrooms: '6', bathrooms: '5', balcony: 'Terrace', pool: '—' },
        { name: 'One Bedroom', plan: 'plan-4.png', type: 'Guest wing', size: '86 m²', bedrooms: '1', bathrooms: '1', balcony: 'Courtyard', pool: '—' },
        { name: 'Two Bedroom', plan: 'plan-3.png', type: 'House', size: '512 m²', bedrooms: '5', bathrooms: '5', balcony: 'Loggia', pool: 'Private' },
        { name: 'Three Bedroom', plan: 'plan-3.png', type: 'House', size: '612 m²', bedrooms: '6', bathrooms: '6', balcony: 'Loggia', pool: 'Private' }
      ],
      landmarks: [
        { name: 'Praia da Comporta', img: 'lm-beach.jpg', min: 10, km: '8 km' },
        { name: 'Carvalhal', img: 'lm-marina.jpg', min: 8, km: '6 km' },
        { name: 'Alcácer do Sal', img: 'lm-burj-khalifa.jpg', min: 30, km: '32 km' },
        { name: 'Troia', img: 'lm-burj-al-arab.jpg', min: 25, km: '23 km' },
        { name: 'Lisbon Airport', img: 'lm-airport.jpg', min: 72, km: '116 km' }
      ],
      nearby: {
        'Schools': [
          { name: 'Escola de Comporta', km: '3.0 km', min: '7 min' },
          { name: 'Colégio de Alcácer', km: '25 km', min: '27 min' },
          { name: 'International School of Lisbon', km: '94 km', min: '69 min' }
        ],
        'Daily needs': [
          { name: 'Mercearia da Comporta', km: '2.6 km', min: '6 min' },
          { name: 'Carvalhal Market', km: '5.8 km', min: '9 min' },
          { name: 'Alcácer do Sal Shopping', km: '25 km', min: '28 min' }
        ],
        'Healthcare': [
          { name: 'Centro de Saúde de Alcácer', km: '26 km', min: '28 min' },
          { name: 'Hospital de Setúbal', km: '55 km', min: '47 min' }
        ],
        'Leisure': [
          { name: 'Praia da Comporta', km: '8.0 km', min: '10 min' },
          { name: 'Herdade da Comporta', km: '10 km', min: '14 min' },
          { name: 'Troia Golf', km: '23 km', min: '25 min' }
        ]
      },
      faqDiff: 'It is the studio’s own house and the reference for every Shadestate project since — one courtyard, one loggia, one pool holding the sky.',
      payment: 'Sold. Resale enquires are handled by the studio by appointment.',
      pets: 'Yes. The garden is walled and opens onto the pine belt.',
      schools: 'The village school is seven minutes away; Lisbon international schools are within an hour and a quarter.'
    }
  };

  var ORDER = ['arbour-townhomes', 'sun-bliss-residence', 'townhouse', 'luxurious-villas', 'casa-da-luz', 'alto-principe', 'mare-residences', 'quinta-do-vale', 'miradouro-terrace', 'shadestate-house'];

  /* ───────────────────────── helpers ───────────────────────── */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function slugFromQuery() {
    var m = /[?&]project=([^&#]+)/.exec(location.search);
    var s = m ? decodeURIComponent(m[1]).replace(/\/+$/, '').toLowerCase() : '';
    return PROJECTS[s] ? s : 'arbour-townhomes';
  }

  var slug = slugFromQuery();
  var p = PROJECTS[slug];

  /* ───────────────────────── isometric art ───────────────────────── */

  var ISO_C = Math.cos(Math.PI / 6);
  var ISO_S = Math.sin(Math.PI / 6);

  function iso(x, y, z) {
    return [(x - y) * ISO_C, (x + y) * ISO_S - (z || 0)];
  }

  function poly(pts, cls) {
    return '<polygon points="' + pts.map(function (q) { return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' ') + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }

  function seg(a, b) {
    return '<line x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) + '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '"/>';
  }

  function plane(x, y, w, d, z) {
    return poly([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);
  }

  function box(x, y, w, d, h, z0) {
    var z = z0 || 0;
    var t = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    var l = iso(x, y, z), r = iso(x + w, y, z), r2 = iso(x + w, y + d, z), l2 = iso(x, y + d, z);
    var tl = iso(x, y, z + h), tr = iso(x + w, y, z + h), tr2 = iso(x + w, y + d, z + h), tl2 = iso(x, y + d, z + h);
    var out = poly(t);
    out += '<path d="M' + l[0].toFixed(2) + ' ' + l[1].toFixed(2) + 'L' + tl[0].toFixed(2) + ' ' + tl[1].toFixed(2) + 'L' + tl2[0].toFixed(2) + ' ' + tl2[1].toFixed(2) + 'L' + l2[0].toFixed(2) + ' ' + l2[1].toFixed(2) + 'Z"/>';
    out += '<path d="M' + r[0].toFixed(2) + ' ' + r[1].toFixed(2) + 'L' + tr[0].toFixed(2) + ' ' + tr[1].toFixed(2) + 'L' + tr2[0].toFixed(2) + ' ' + tr2[1].toFixed(2) + 'L' + r2[0].toFixed(2) + ' ' + r2[1].toFixed(2) + 'Z"/>';
    return out;
  }

  function tree(x, y, z, r) {
    var c = iso(x, y, (z || 0) + r * 0.9);
    return seg(iso(x, y, z || 0), iso(x, y, (z || 0) + r * 0.9)) +
      '<circle cx="' + c[0].toFixed(2) + '" cy="' + c[1].toFixed(2) + '" r="' + (r * 7).toFixed(2) + '"/>' +
      '<circle cx="' + (c[0] - r * 4).toFixed(2) + '" cy="' + (c[1] + r * 3).toFixed(2) + '" r="' + (r * 4.6).toFixed(2) + '"/>' +
      '<circle cx="' + (c[0] + r * 4.4).toFixed(2) + '" cy="' + (c[1] + r * 2.4).toFixed(2) + '" r="' + (r * 4).toFixed(2) + '"/>';
  }

  function art(kind) {
    var w = 220, h = 170, ox = 110, oy = 108, s = 15;

    function T(pts) { return pts; }
    var body = '';

    function g(x, y, z) {
      var q = iso(x, y, z);
      return [ox + q[0] * s, oy + q[1] * s];
    }
    // local iso in screen units
    function L(x, y, z) { return g(x, y, z || 0); }
    function pl(x, y, ww, dd, z) {
      return poly([L(x, y, z), L(x + ww, y, z), L(x + ww, y + dd, z), L(x, y + dd, z)]);
    }
    function bx(x, y, ww, dd, hh, z0) {
      var z = z0 || 0;
      var top = [L(x, y, z + hh), L(x + ww, y, z + hh), L(x + ww, y + dd, z + hh), L(x, y + dd, z + hh)];
      var a = L(x, y, z), b = L(x + ww, y, z), c = L(x + ww, y + dd, z), d = L(x, y + dd, z);
      var ta = L(x, y, z + hh), tb = L(x + ww, y, z + hh), tc = L(x + ww, y + dd, z + hh), td = L(x, y + dd, z + hh);
      var out = poly(top);
      out += '<path d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + ta[0].toFixed(1) + ' ' + ta[1].toFixed(1) + 'L' + td[0].toFixed(1) + ' ' + td[1].toFixed(1) + 'L' + d[0].toFixed(1) + ' ' + d[1].toFixed(1) + 'Z"/>';
      out += '<path d="M' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + 'L' + tb[0].toFixed(1) + ' ' + tb[1].toFixed(1) + 'L' + tc[0].toFixed(1) + ' ' + tc[1].toFixed(1) + 'L' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + 'Z"/>';
      return out;
    }
    function ln(a, b) { return seg(a, b); }
    function tr(x, y, z, r) {
      var base = L(x, y, z || 0);
      var mid = L(x, y, (z || 0) + r * 1.1);
      return ln(base, mid) +
        '<circle cx="' + mid[0].toFixed(1) + '" cy="' + (mid[1] - r * 7).toFixed(1) + '" r="' + (r * 8).toFixed(1) + '"/>' +
        '<circle cx="' + (mid[0] - r * 7).toFixed(1) + '" cy="' + (mid[1] - r * 3).toFixed(1) + '" r="' + (r * 5.4).toFixed(1) + '"/>' +
        '<circle cx="' + (mid[0] + r * 7).toFixed(1) + '" cy="' + (mid[1] - r * 4).toFixed(1) + '" r="' + (r * 5).toFixed(1) + '"/>';
    }

    switch (kind) {
      case 'gardens':
        body += pl(0, 0, 10, 7, 0);
        body += pl(0.6, 0.6, 4.2, 2.6, 0.02);
        body += pl(5.4, 0.6, 4, 2.6, 0.02);
        body += pl(0.6, 3.6, 3.4, 2.8, 0.02);
        body += pl(4.4, 3.6, 5, 2.8, 0.02);
        body += tr(2.4, 2, 0, 0.9) + tr(7.6, 2, 0, 0.8) + tr(2.2, 5.2, 0, 0.75) + tr(7.4, 5.1, 0, 0.9);
        body += ln(L(0, 7.6, 0), L(10, 7.6, 0));
        break;
      case 'play':
        body += pl(0, 0, 10, 7, 0);
        body += ln(L(1.2, 1.2, 3.4), L(1.2, 1.2, 0)) + ln(L(4.6, 1.2, 3.4), L(4.6, 1.2, 0));
        body += ln(L(1.2, 1.2, 3.4), L(4.6, 1.2, 3.4));
        body += ln(L(2.1, 1.2, 3.4), L(2.1, 1.2, 1.6)) + ln(L(3.7, 1.2, 3.4), L(3.7, 1.2, 1.6));
        body += pl(1.8, 1.0, 1.0, 0.5, 1.55);
        body += poly([L(2.1, 1.2, 3.4), L(2.6, 1.2, 3.4), L(2.6, 2.0, 3.4), L(2.1, 2.0, 3.4)]);
        body += tr(8.2, 1.6, 0, 1.0) + tr(8.8, 5.2, 0, 0.8);
        body += pl(5.6, 4.6, 2.4, 1.6, 0.02);
        break;
      case 'tennis':
        body += pl(0, 0, 12, 7.2, 0);
        body += pl(0.6, 0.6, 10.8, 6, 0.02);
        body += ln(L(6, 0.6, 0.02), L(6, 6.6, 0.02));
        body += ln(L(0.6, 3.6, 0.02), L(11.4, 3.6, 0.02));
        body += ln(L(6, 0.4, 0), L(6, 0.4, 1.6)) + ln(L(6, 6.8, 0), L(6, 6.8, 1.6));
        body += ln(L(6, 0.4, 1.55), L(6, 6.8, 1.55));
        body += ln(L(0.2, 7.4, 0), L(12.2, 7.4, 0));
        break;
      case 'yoga':
        body += pl(0, 0, 9, 8, 0);
        for (var i = 0; i < 6; i++) body += ln(L(0, 1 + i * 1.2, 0.01), L(9, 1 + i * 1.2, 0.01));
        body += pl(1.6, 1.4, 2.6, 1.2, 0.04) + pl(5.0, 4.6, 2.6, 1.2, 0.04);
        body += ln(L(2.9, 1.4, 0.04), L(2.9, 2.6, 0.04));
        body += ln(L(6.3, 4.6, 0.04), L(6.3, 5.8, 0.04));
        body += tr(8.1, 1.2, 0, 0.9) + tr(1.0, 6.9, 0, 0.8);
        break;
      case 'gym':
        body += pl(0, 0, 10.4, 7.4, 0);
        body += bx(1, 1.2, 4.2, 1.2, 0.5);
        body += bx(1.1, 1.35, 1.2, 0.9, 0.9);
        body += ln(L(6.2, 1.2, 0), L(6.2, 1.2, 2.2)) + ln(L(8.4, 1.2, 0), L(8.4, 1.2, 2.2));
        body += ln(L(6.2, 1.2, 2.2), L(8.4, 1.2, 2.2));
        body += ln(L(6.6, 1.2, 1.1), L(6.6, 1.2, 1.7)) + ln(L(8, 1.2, 1.1), L(8, 1.2, 1.7));
        body += bx(6.4, 5.4, 3.0, 1.2, 0.35);
        body += bx(6.7, 5.6, 0.5, 0.8, 0.55) + bx(8.6, 5.6, 0.5, 0.8, 0.55);
        break;
      case 'parking':
        body += pl(0, 0, 11, 7.6, 0);
        body += ln(L(0, 2.6, 0.01), L(11, 2.6, 0.01));
        body += ln(L(0, 5.2, 0.01), L(11, 5.2, 0.01));
        for (var k = 0; k < 4; k++) body += ln(L(0.6 + k * 2.7, 0, 0.01), L(0.6 + k * 2.7, 7.6, 0.01));
        body += bx(1.4, 3.0, 1.7, 1.6, 0.7) + bx(4.1, 3.0, 1.7, 1.6, 0.7) + bx(6.8, 3.0, 1.7, 1.6, 0.7);
        body += bx(1.6, 3.2, 1.3, 1.2, 0.45) + bx(4.3, 3.2, 1.3, 1.2, 0.45) + bx(7.0, 3.2, 1.3, 1.2, 0.45);
        break;
      case 'security':
        body += pl(0, 0, 10, 7, 0);
        body += bx(1.2, 1.4, 3.2, 2.6, 2.0);
        body += ln(L(1.2, 4.0, 2.0), L(4.4, 4.0, 2.0)) + ln(L(1.2, 1.4, 1.0), L(4.4, 1.4, 1.0));
        body += ln(L(4.6, 4.0, 0), L(4.6, 4.0, 2.4)) + ln(L(4.6, 4.0, 2.4), L(8.4, 4.0, 2.4));
        body += ln(L(8.4, 4.0, 2.4), L(8.4, 4.0, 2.0));
        body += '<path d="M' + L(6.2, 2.2, 3.2)[0].toFixed(1) + ' ' + L(6.2, 2.2, 3.2)[1].toFixed(1) + 'l1.6 .6l-.2 1.7l-1.4 1.1l-1.4-1.1l-.2-1.7Z"/>';
        body += tr(8.8, 6.0, 0, 0.85);
        break;
      case 'lounge':
      default:
        body += pl(0, 0, 10, 7.4, 0);
        body += bx(0.9, 0.9, 3.4, 1.2, 0.55);
        body += bx(0.9, 0.9, 1.1, 1.2, 0.95);
        body += bx(5.6, 5.0, 3.4, 1.2, 0.55);
        body += bx(8.0, 5.0, 1.0, 1.2, 0.95);
        body += bx(0.9, 5.0, 1.2, 1.6, 0.5);
        body += bx(7.6, 0.9, 1.2, 1.6, 0.5);
        body += bx(4.2, 3.0, 2.0, 1.4, 0.35);
        body += tr(9.0, 2.0, 0, 0.8);
        break;
    }

    var fit = '<g transform="translate(110 86) scale(0.66) translate(-110 -86)">' + body + '</g>';
    return '<svg viewBox="0 0 220 172" aria-hidden="true" focusable="false">' + fit + '</svg>';
  }

  /* ───────────────────────── render: hero ───────────────────────── */

  function renderHero() {
    document.title = p.name + ' — Shadestate';
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.name + ' by Shadestate — ' + p.type + ' in ' + p.location + '. Specifications, residences, floor plans and everything close by.');

    $('#projectTitle').textContent = p.name;
    $('#projectPrice').textContent = p.price;
    $('#overviewText').textContent = p.overview;
    $('#overviewNote').textContent = p.note;

    var spec = [
      ['STATUS', p.status],
      ['LOCATION', p.location],
      ['PROPERTY TYPE', p.type],
      ['HANDOVER', p.handover],
      ['UNIT SIZE', p.size]
    ];
    $('#specList').innerHTML = spec.map(function (r) {
      return '<div class="spec__row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    var hero = $('#heroImage');
    hero.src = IMG + p.hero;
    hero.alt = p.heroAlt;
    var cap = $('#heroCap');
    if (cap) cap.textContent = p.heroCap;

    var bro = $('#broSpecList');
    if (bro) {
      bro.innerHTML = '<div><dt>Status</dt><dd>' + esc(p.status) + '</dd></div>' +
        '<div><dt>Location</dt><dd>' + esc(p.location) + '</dd></div>' +
        '<div><dt>Type</dt><dd>' + esc(p.type) + '</dd></div>' +
        '<div><dt>Handover</dt><dd>' + esc(p.handover) + '</dd></div>' +
        '<div><dt>Starting from</dt><dd>' + esc(p.price) + '</dd></div>' +
        '<div><dt>Unit size</dt><dd>' + esc(p.size) + '</dd></div>';
      $('#broTitle').textContent = p.name;
      $('#broSpec').textContent = p.location + ' · ' + p.type + ' · ' + p.handover;
    }

    $('#landmarksSub').textContent = 'Drive times from ' + p.name + ', measured at off-peak hours.';

    var telHref = 'tel:+97140000000';
    var waHref = 'https://wa.me/971000000000?text=' + encodeURIComponent('Hello Shadestate — I would like to know more about ' + p.name + '.');
    $('#callLink').href = telHref;
    $('#waLink').href = waHref;
    $('#waLinkFloat').href = waHref;
    $('#enqProject').textContent = p.name.toUpperCase();
    $('#mapProjectName').textContent = p.name;
  }

  /* ───────────────────────── landmarks ───────────────────────── */

  function renderLandmarks() {
    var row = $('#landmarkRow');
    row.innerHTML = '';
    var maxMin = Math.max.apply(null, p.landmarks.map(function (l) { return l.min; }));

    p.landmarks.forEach(function (l, i) {
      var li = el('li', 'landmark reveal');
      li.style.transitionDelay = (i * 60) + 'ms';

      var ring = el('div', 'landmark__ring');
      var pct = Math.min(0.92, Math.max(0.14, l.min / (maxMin * 1.25)));
      var r = 49, c = 2 * Math.PI * r;
      ring.innerHTML =
        '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="track" cx="50" cy="50" r="' + r + '"/>' +
        '<circle class="prog" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-dash="' + (c * (1 - pct)).toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="landmark__img"><img src="' + IMG + l.img + '" alt="' + esc(l.name) + '" loading="lazy" decoding="async" width="600" height="600"></div>';

      var time = el('p', 'landmark__time', '<span class="num" data-min="' + l.min + '">0</span><small>min</small>');
      var name = el('p', 'landmark__name', esc(l.name));
      var dist = el('p', 'landmark__dist', esc(l.km));

      li.appendChild(ring);
      li.appendChild(time);
      li.appendChild(name);
      li.appendChild(dist);
      row.appendChild(li);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var item = e.target;
        var prog = item.querySelector('.prog');
        if (prog) prog.style.strokeDashoffset = prog.getAttribute('data-dash');
        var num = item.querySelector('.num');
        if (num && !num.dataset.done) {
          num.dataset.done = '1';
          countUp(num, parseInt(num.getAttribute('data-min'), 10), 1000);
        }
        item.classList.add('in');
        io.unobserve(item);
      });
    }, { threshold: .3 });

    $$('.landmark', row).forEach(function (n) { io.observe(n); });
  }

  function countUp(node, target, dur) {
    var start = performance.now();
    function tick(t) {
      var k = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(tick);
      else node.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  /* ───────────────────────── gallery ───────────────────────── */

  function renderGallery() {
    var track = $('#galleryTrack');
    track.innerHTML = '';
    p.gallery.forEach(function (g, i) {
      var a = el('article', 'gitem reveal' + (i === 0 ? ' gitem--lead' : ''));
      a.innerHTML =
        '<p class="gitem__num">' + pad2(i + 1) + '</p>' +
        '<figure class="gitem__fig"><img src="' + IMG + g.img + '" alt="' + esc(p.name + ' — ' + g.cap) + '" loading="' + (i > 1 ? 'lazy' : 'eager') + '" decoding="async" width="900" height="1125"></figure>' +
        '<p class="gitem__cap"><span>' + esc(g.cap) + '</span><span>' + esc(g.sub) + '</span></p>';
      track.appendChild(a);
    });

    track.scrollLeft = 0;
    var step = function () {
      var first = $('.gitem', track);
      return first ? first.getBoundingClientRect().width + 20 : 320;
    };
    $('#galPrev').addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    $('#galNext').addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });
  }

  /* ───────────────────────── amenities ───────────────────────── */

  var ART_KEYS = ['gardens', 'play', 'tennis', 'yoga', 'gym', 'parking', 'security', 'lounge'];

  function renderAmenities() {
    var grid = $('#amenityGrid');
    grid.innerHTML = '';
    p.amenities.forEach(function (name, i) {
      var d = el('article', 'amenity reveal');
      d.style.transitionDelay = (i % 4 * 50) + 'ms';
      d.innerHTML =
        '<div class="amenity__art">' + art(ART_KEYS[i % ART_KEYS.length]) + '</div>' +
        '<div class="amenity__foot"><span class="amenity__no">' + pad2(i + 1) + '</span><span class="amenity__name">' + esc(name) + '</span></div>';
      grid.appendChild(d);
    });
  }

  /* ───────────────────────── layouts ───────────────────────── */

  var activeLayout = 0;

  function renderLayouts() {
    var tabs = $('#layoutTabs');
    tabs.innerHTML = '';
    p.layouts.forEach(function (l, i) {
      var b = el('button', 'tab', esc(l.name));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-controls', 'planStage');
      b.id = 'tab-' + i;
      b.addEventListener('click', function () { setLayout(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + p.layouts.length) % p.layouts.length;
        setLayout(n);
        $('#tab-' + n).focus();
      });
      tabs.appendChild(b);
    });
    setLayout(0, true);
  }

  function setLayout(i, silent) {
    activeLayout = i;
    var l = p.layouts[i];
    $$('#layoutTabs .tab').forEach(function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
      t.tabIndex = k === i ? 0 : -1;
    });

    var stage = $('#planStage'), img = $('#planImage');
    stage.classList.remove('is-swap');
    img.style.opacity = '0';
    setTimeout(function () {
      img.src = IMG + l.plan;
      img.alt = l.name + ' floor plan — ' + p.name;
      img.onload = function () { img.style.opacity = '1'; };
      if (img.complete) img.style.opacity = '1';
    }, silent ? 0 : 120);

    var stageEl = $('#planStage');
    if (stageEl) stageEl.setAttribute('aria-labelledby', 'tab-' + i);

    $('#planCount').innerHTML = pad2(i + 1) + ' <span>/ ' + pad2(p.layouts.length) + '</span>';
    $('#planStageName').textContent = l.name;
    $('#planTitle').textContent = l.name;

    var rows = [
      ['Type', l.type],
      ['Size', l.size],
      ['Bedrooms', l.bedrooms],
      ['Bathrooms', l.bathrooms],
      ['Balcony', l.balcony],
      ['Pool deck', l.pool]
    ];
    $('#planSpec').innerHTML = rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    var dl = $('#planDownload');
    dl.href = IMG + l.plan;
    dl.setAttribute('download', slug + '-' + l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png');
  }

  /* ───────────────────────── nearby + map ───────────────────────── */

  var CATS = ['Schools', 'Daily needs', 'Healthcare', 'Leisure'];
  var activeCat = 'All';

  function renderNearby() {
    var filters = $('#nearbyFilters');
    filters.innerHTML = '';
    ['All'].concat(CATS).forEach(function (c) {
      var b = el('button', 'chip', esc(c));
      b.type = 'button';
      b.setAttribute('aria-pressed', c === 'All' ? 'true' : 'false');
      b.dataset.cat = c;
      b.addEventListener('click', function () { setCat(c); });
      filters.appendChild(b);
    });

    var list = $('#nearbyList');
    list.innerHTML = '';
    CATS.forEach(function (c) {
      var items = p.nearby[c] || [];
      if (!items.length) return;
      var g = el('section', 'nearby__group');
      g.dataset.cat = c;
      g.innerHTML = '<h3 class="nearby__group-title">' + esc(c) + '</h3>';
      items.forEach(function (place, idx) {
        var b = el('button', 'place');
        b.type = 'button';
        b.dataset.pin = c + '-' + idx;
        b.innerHTML =
          '<span class="place__name">' + esc(place.name) + '</span>' +
          '<span class="place__meta"><span class="place__dist">' + esc(place.km) + '</span><span class="place__time">' + esc(place.min) + '</span></span>';
        b.addEventListener('click', function () { focusPin(c + '-' + idx, b); });
        g.appendChild(b);
      });
      list.appendChild(g);
    });

    buildMap();
    setCat('All');
  }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildMap() {
    var svg = $('#mapSvg');
    var r = rng(hash(slug));
    var W = 800, H = 620;
    var out = '<rect width="' + W + '" height="' + H + '" fill="#F1EFE9"/>';

    // land blocks
    var x = -20, y = -20;
    var blocks = [];
    while (y < H + 20) {
      var rowH = 52 + r() * 46;
      x = -20;
      while (x < W + 20) {
        var w = 70 + r() * 90;
        blocks.push([x, y, w, rowH]);
        x += w + 10 + r() * 8;
      }
      y += rowH + 11 + r() * 8;
    }
    blocks.forEach(function (b) {
      out += '<rect x="' + b[0].toFixed(1) + '" y="' + b[1].toFixed(1) + '" width="' + (b[2] - 6).toFixed(1) + '" height="' + (b[3] - 6).toFixed(1) + '" rx="2" fill="#E6E2D8"/>';
    });

    // parks
    out += '<ellipse cx="640" cy="120" rx="120" ry="78" fill="#DFE6D5"/>';
    out += '<ellipse cx="150" cy="520" rx="130" ry="72" fill="#DFE6D5"/>';
    out += '<rect x="270" y="250" width="150" height="96" rx="4" fill="#DFE6D5"/>';

    // water
    out += '<path d="M-20 470 C120 440 190 520 300 512 C420 504 470 570 520 640 L-20 640 Z" fill="#DCE5E6"/>';

    // roads
    out += '<g stroke="#FFFFFF" fill="none" stroke-linecap="round">';
    out += '<path d="M-20 210 C160 190 260 240 420 226 C560 214 680 250 820 214" stroke-width="14"/>';
    out += '<path d="M-20 430 C140 410 240 452 360 440 C500 426 640 470 820 438" stroke-width="10"/>';
    out += '<path d="M240 -20 C250 120 210 260 250 400 C280 500 300 560 296 640" stroke-width="12"/>';
    out += '<path d="M600 -20 C580 120 620 260 590 400 C570 500 590 570 600 640" stroke-width="9"/>';
    out += '<path d="M-20 320 C120 300 260 340 420 320 C560 302 700 330 820 312" stroke-width="7"/>';
    out += '</g>';

    // road names
    out += '<g fill="rgba(17,17,17,.34)" font-family="Inter,Helvetica,Arial,sans-serif" font-size="10" letter-spacing="1.4">';
    out += '<text x="330" y="204">AL KHALEEL STREET</text>';
    out += '<text x="330" y="424">DUBAI HILLS BOULEVARD</text>';
    out += '<text x="258" y="120" transform="rotate(90 258 120)">PARK AVENUE</text>';
    out += '<text x="610" y="300" transform="rotate(90 610 300)">GOLF CLUB DRIVE</text>';
    out += '</g>';

    out += '<g fill="rgba(17,17,17,.22)" font-family="Inter,Helvetica,Arial,sans-serif" font-size="10" letter-spacing="2" text-anchor="middle">';
    out += '<text x="640" y="124">DUBAI HILLS PARK</text>';
    out += '<text x="150" y="524">COMMUNITY GARDENS</text>';
    out += '</g>';

    svg.innerHTML = out;

    // pins
    var pins = $('#mapPins');
    pins.innerHTML = '';
    var home = el('div', 'pin pin--home');
    home.style.left = '47%';
    home.style.top = '52%';
    home.innerHTML = '<span class="pin__dot"></span><span class="pin__label">' + esc(p.short) + '</span>';
    pins.appendChild(home);

    var rr = rng(hash(slug + 'pins'));
    var spots = [
      [22, 20], [70, 18], [82, 40], [63, 66], [30, 74], [15, 42], [55, 30], [40, 80], [76, 82], [12, 62], [86, 62]
    ];
    var n = 0;
    CATS.forEach(function (c) {
      (p.nearby[c] || []).forEach(function (place, idx) {
        var spot = spots[n % spots.length];
        n++;
        var pin = el('div', 'pin');
        pin.dataset.pin = c + '-' + idx;
        pin.dataset.cat = c;
        pin.style.left = (spot[0] + (rr() * 6 - 3)) + '%';
        pin.style.top = (spot[1] + (rr() * 6 - 3)) + '%';
        pin.innerHTML = '<span class="pin__dot"></span><span class="pin__label">' + esc(place.name) + ' · ' + esc(place.min) + '</span>';
        pin.addEventListener('click', function () { focusPlace(c + '-' + idx, pin); });
        pins.appendChild(pin);
      });
    });
  }

  function setCat(c) {
    activeCat = c;
    $$('#nearbyFilters .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.cat === c ? 'true' : 'false');
    });
    $$('#nearbyList .nearby__group').forEach(function (g) {
      g.hidden = !(c === 'All' || g.dataset.cat === c);
    });
    $$('#mapPins .pin').forEach(function (pin) {
      if (pin.classList.contains('pin--home')) return;
      var on = c === 'All' || pin.dataset.cat === c;
      pin.classList.toggle('is-dim', !on);
    });
  }

  function focusPin(key, row) {
    $$('#mapPins .pin').forEach(function (pin) {
      pin.classList.toggle('is-active', pin.dataset.pin === key);
    });
    $$('#nearbyList .place').forEach(function (b) { b.classList.toggle('is-active', b === row); });
  }

  function focusPlace(key, pin) {
    $$('#mapPins .pin').forEach(function (n) { n.classList.toggle('is-active', n === pin); });
    var row = $('#nearbyList .place[data-pin="' + key + '"]');
    $$('#nearbyList .place').forEach(function (b) { b.classList.toggle('is-active', b === row); });
    if (row && row.offsetParent) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ───────────────────────── masterplan + faq + explore ───────────────────────── */

  function renderMasterplan() {
    var img = $('#masterplanImage');
    img.src = IMG + p.masterplan;
    img.alt = p.masterplanAlt;
  }

  function renderFaq() {
    var list = $('#faqList');
    list.innerHTML = '';
    faqs(p).forEach(function (f, i) {
      var item = el('article', 'faq__item' + (i === 0 ? ' is-open' : ''));
      item.innerHTML =
        '<button class="faq__q" type="button" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
        '<span class="faq__no">' + pad2(i + 1) + '</span>' +
        '<span class="faq__text">' + esc(f.q) + '</span>' +
        '<span class="faq__sign" aria-hidden="true">+</span>' +
        '</button>' +
        '<div class="faq__a"><div><p>' + esc(f.a) + '</p></div></div>';
      var btn = $('.faq__q', item);
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      list.appendChild(item);
    });
  }

  function renderExplore() {
    var grid = $('#exploreGrid');
    grid.innerHTML = '';
    var others = ORDER.filter(function (s) { return s !== slug; });
    others.sort(function (a, b) {
      var ca = PROJECTS[a].city === p.city ? 0 : 1;
      var cb = PROJECTS[b].city === p.city ? 0 : 1;
      return ca - cb;
    });
    others.slice(0, 3).forEach(function (s) {
      var o = PROJECTS[s];
      var a = el('a', 'ecard reveal');
      a.href = 'project.html?project=' + encodeURIComponent(s);
      a.innerHTML =
        '<div class="ecard__fig"><img src="' + IMG + o.hero + '" alt="' + esc(o.name + ' — ' + o.location) + '" loading="lazy" decoding="async" width="800" height="600"></div>' +
        '<p class="ecard__loc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>' + esc(o.location) + '</p>' +
        '<p class="ecard__name">' + esc(o.name) + '</p>' +
        '<p class="ecard__meta">' + esc(o.type + ' · ' + o.price) + '</p>';
      grid.appendChild(a);
    });
  }

  /* ───────────────────────── menu, dock, theme ───────────────────────── */

  function renderMenu() {
    var ul = $('#menuProjects');
    ul.innerHTML = '';
    ORDER.forEach(function (s) {
      var o = PROJECTS[s];
      var li = el('li');
      li.innerHTML = '<a href="project.html?project=' + encodeURIComponent(s) + '"' + (s === slug ? ' aria-current="page"' : '') + '>' +
        '<span>' + esc(o.name) + '</span><span>' + esc(o.city) + '</span></a>';
      ul.appendChild(li);
    });
  }

  function initMenu() {
    var menu = $('#menu');
    var btn = $('#menuBtn');
    var open = false;

    function setMenu(state) {
      open = state;
      if (state) {
        menu.hidden = false;
        requestAnimationFrame(function () { menu.classList.add('is-open'); });
        document.body.style.overflow = 'hidden';
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = 'CLOSE <span class="btn__dots" aria-hidden="true">✕</span>';
        setTimeout(function () { $('.menu__nav a', menu).focus(); }, 120);
      } else {
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = 'MENU <span class="btn__dots" aria-hidden="true">••</span>';
        setTimeout(function () { menu.hidden = true; }, 380);
      }
    }

    btn.addEventListener('click', function () { setMenu(!open); });
    $$('[data-close-menu]', menu).forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
    $$('.menu a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setMenu(false);
    });
  }

  function initModals() {
    var lastFocus = null;

    function openModal(id) {
      var m = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
      if (!m) return;
      lastFocus = document.activeElement;
      m.hidden = false;
      document.body.classList.add('modal-open');
      var f = m.querySelector('input,textarea,button');
      if (f) setTimeout(function () { f.focus(); }, 60);
    }
    function closeModal(m) {
      m.hidden = true;
      document.body.classList.remove('modal-open');
      if (lastFocus) lastFocus.focus();
    }

    $$('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        openModal(b.getAttribute('data-open'));
      });
    });
    $$('.modal').forEach(function (m) {
      $$('[data-close-modal]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(m); }); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.modal').forEach(function (m) { if (!m.hidden) closeModal(m); });
    });

    // enquire form
    var form = $('#enqForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#enqName'), email = $('#enqEmail'), out = $('#enqMsgOut');
      if (!name.value.trim() || !email.value.trim() || email.value.indexOf('@') < 1) {
        out.textContent = 'Please add your name and a valid email address.';
        (!name.value.trim() ? name : email).focus();
        return;
      }
      out.textContent = 'Thank you, ' + name.value.trim().split(' ')[0] + '. Our team will be in touch within one working day.';
      form.reset();
    });

    // brochure
    var bro = $('#modalBrochure');
    $('#broDownload').addEventListener('click', function () {
      var rows = [
        ['Project', p.name], ['Location', p.location], ['Status', p.status], ['Property type', p.type],
        ['Starting from', p.price], ['Handover', p.handover], ['Unit size', p.size]
      ];
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(p.name) + ' — Brochure</title>' +
        '<style>body{font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:64px auto;padding:0 32px;color:#111}h1{font-weight:300;letter-spacing:-.02em;font-size:44px;text-transform:uppercase;margin:0 0 8px}h2{font-size:15px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;margin:32px 0 10px}p{line-height:1.6;font-size:15px}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:10px 0;border-bottom:1px solid #ddd;font-size:14px}td:first-child{color:#666;text-transform:uppercase;letter-spacing:.08em;font-size:11px;width:40%}li{font-size:14px;line-height:1.7}</style></head><body>' +
        '<h1>' + esc(p.name) + '</h1><p>' + esc(p.location) + ' · ' + esc(p.type) + '</p>' +
        '<table>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
        '<h2>Overview</h2><p>' + esc(p.overview) + '</p>' +
        '<h2>Amenities</h2><ul>' + p.amenities.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
        '<h2>Layouts</h2><table>' + p.layouts.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.size + ' · ' + l.bedrooms + ' bed · ' + l.bathrooms + ' bath') + '</td></tr>'; }).join('') + '</table>' +
        '<p style="margin-top:40px;font-size:11px;color:#777">Shadestate · Office 1204, Bay Square 7, Business Bay, Dubai · hello@shadestate.com</p>' +
        '</body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = slug + '-brochure.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    // newsletter
    var news = $('#newsForm'), msg = $('#newsMsg');
    news.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#newsEmail').value.trim();
      if (v.indexOf('@') < 1) { msg.textContent = 'Please enter a valid email.'; return; }
      msg.textContent = 'Thank you — you are on the list.';
      news.reset();
    });
  }

  function initScrollUI() {
    var top = $('#topbar');
    var dock = $('#dock');
    var quick = $('#quick');
    var hero = $('#project');
    var sections = ['overview', 'gallery', 'amenities', 'plans', 'location', 'faq'];
    var darkSections = $$('[data-theme="dark"]');

    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;

      var dark = false;
      darkSections.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= 60 && r.bottom >= 60) dark = true;
      });
      document.body.classList.toggle('theme-dark', dark);
      top.classList.toggle('is-solid', y > 48 && !dark);

      var heroBottom = hero.getBoundingClientRect().bottom;
      var foot = document.querySelector('.footer');
      var footTop = foot ? foot.getBoundingClientRect().top : 1e9;
      var show = heroBottom < 40 && footTop > window.innerHeight - 90;
      dock.classList.toggle('is-visible', show);
      quick.classList.toggle('is-visible', show);

      var current = '';
      sections.forEach(function (id) {
        var s = document.getElementById(id);
        if (!s) return;
        var r = s.getBoundingClientRect();
        if (r.top <= window.innerHeight * .45 && r.bottom > window.innerHeight * .45) current = id;
      });
      $$('#dock a').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-spy') === current);
      });

    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();

    $$('[data-top]').forEach(function (b) {
      b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
  }

  function initReveal() {
    var nodes = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .08, rootMargin: '120px 0px -30px 0px' });
    nodes.forEach(function (n) { io.observe(n); });

    // Safety net: smooth scrolling and programmatic jumps can skip an item, so
    // anything that has entered (or passed) the viewport is revealed on settle.
    var settling = false;
    function catchUp() {
      settling = false;
      var vh = window.innerHeight;
      nodes.forEach(function (n) {
        if (n.classList.contains('in')) return;
        var r = n.getBoundingClientRect();
        if (r.top < vh + 120 && r.bottom > -120) { n.classList.add('in'); io.unobserve(n); }
      });
    }
    window.addEventListener('scroll', function () {
      if (settling) return;
      settling = true;
      setTimeout(catchUp, 120);
    }, { passive: true });
    window.addEventListener('resize', catchUp);
    setTimeout(catchUp, 900);
  }

  function initGalleryWheel() {
    var track = $('#galleryTrack');
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        var max = track.scrollWidth - track.clientWidth;
        if ((e.deltaY > 0 && track.scrollLeft < max - 1) || (e.deltaY < 0 && track.scrollLeft > 1)) {
          track.scrollLeft += e.deltaY;
        }
      }
    }, { passive: true });
  }

  /* ───────────────────────── footer art ───────────────────────── */

  function skyline() {
    var wrap = $('#skyline');
    var w = 1600, h = 260;
    var r = rng(20261119);
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">';
    var x = -40;
    while (x < w + 40) {
      var bw = 34 + r() * 90;
      var bh = 40 + r() * 150;
      var y = h - bh;
      out += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" fill="#1b1b1b"/>';
      // windows
      var cols = Math.max(1, Math.floor(bw / 16));
      var rows = Math.max(1, Math.floor(bh / 20));
      for (var cc = 0; cc < cols; cc++) {
        for (var rr2 = 0; rr2 < rows; rr2++) {
          if (r() > .55) out += '<rect x="' + (x + 7 + cc * 15).toFixed(0) + '" y="' + (y + 9 + rr2 * 18).toFixed(0) + '" width="4" height="6" fill="#2c2c2c"/>';
        }
      }
      x += bw + 8 + r() * 26;
    }
    out += '<rect x="0" y="' + (h - 6) + '" width="' + w + '" height="6" fill="#1b1b1b"/></svg>';
    wrap.innerHTML = out;
  }

  function ctaArt() {
    // Exploded axonometric tower: stacked floor plates, corner columns, label leaders.
    var W = 520, H = 420;
    var cx = 190, cy = 315, k = 0.86;
    function L(x, y, z) { return [cx + (x - y) * k, cy + (x + y) * 0.5 * k - z * k]; }
    function n(v) { return v.toFixed(1); }
    function line(a, b) { return '<line x1="' + n(a[0]) + '" y1="' + n(a[1]) + '" x2="' + n(b[0]) + '" y2="' + n(b[1]) + '"/>'; }
    function flat(x, y, w, d, z) {
      var p1 = L(x, y, z), p2 = L(x + w, y, z), p3 = L(x + w, y + d, z), p4 = L(x, y + d, z);
      return '<path d="M' + n(p1[0]) + ' ' + n(p1[1]) + 'L' + n(p2[0]) + ' ' + n(p2[1]) +
             'L' + n(p3[0]) + ' ' + n(p3[1]) + 'L' + n(p4[0]) + ' ' + n(p4[1]) + 'Z"/>';
    }

    var out = '';
    var w = 108, d = 80;
    var zs = [0, 35, 70, 105, 140, 175];

    // ground plate
    out += flat(-24, -18, w + 48, d + 36, -26);
    for (var i = 0; i < zs.length; i++) {
      out += flat(0, 0, w, d, zs[i]);
    }
    // corner columns across the whole stack
    [[0, 0], [w, 0], [w, d], [0, d]].forEach(function (c) {
      out += line(L(c[0], c[1], zs[0]), L(c[0], c[1], zs[zs.length - 1] + 18));
    });
    // roof crown
    out += flat(0, 0, w, d, zs[zs.length - 1] + 18);
    out += flat(30, 24, 42, 32, zs[zs.length - 1] + 34);
    [[30, 24], [72, 24], [72, 56], [30, 56]].forEach(function (c) {
      out += line(L(c[0], c[1], zs[zs.length - 1] + 18), L(c[0], c[1], zs[zs.length - 1] + 34));
    });

    // balconies: short plates on the two visible faces
    zs.slice(1, 5).forEach(function (z, i) {
      out += flat(4, d + 2, 34, 10, z);
      out += flat(w + 2, 6, 10, 30, z);
    });

    // labels
    var notes = [
      ['SKY LOUNGE', zs[zs.length - 1] + 26],
      ['RESIDENCES', zs[4] + 6],
      ['POOL + GYM', zs[2] + 6],
      ['LOBBY + RETAIL', zs[1] + 4],
      ['PARKING', -26]
    ];
    notes.forEach(function (nt) {
      var a = L(w + 12, d * 0.55, nt[1]);
      var b = [a[0] + 34, a[1]];
      var c = [b[0] + 22, b[1]];
      out += line(a, b) + line(b, c);
      out += '<circle cx="' + n(a[0]) + '" cy="' + n(a[1]) + '" r="1.6" fill="#111" stroke="none"/>';
      out += '<text x="' + n(c[0] + 6) + '" y="' + n(c[1] + 2.5) + '">' + nt[0] + '</text>';
    });

    $('#ctaArt').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + out + '</svg>';
  }

  /* ───────────────────────── boot ───────────────────────── */

  function init() {
    renderHero();
    renderLandmarks();
    renderGallery();
    renderAmenities();
    renderLayouts();
    renderNearby();
    renderMasterplan();
    renderFaq();
    renderExplore();
    renderMenu();
    initMenu();
    initModals();
    initScrollUI();
    initGalleryWheel();
    ctaArt();
    skyline();
    initReveal();

    // mark current menu link
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
