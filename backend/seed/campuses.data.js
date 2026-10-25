// Campuses that `npm run seed` creates or updates.
//
// ➕ To add your college: copy one block, change the name, slug, emailDomains and coordinates.
//    emailDomains decides who can join, so use the domain on your college email (the part after @).
// 📍 Coordinates are approximate. Right-click a spot in Google Maps to copy its exact "lat, lng".
//    Note the order below: around(lat, lng) here, but MongoDB stores [lng, lat].

const METERS_PER_DEGREE = 111320;

// A point `north` metres north and `east` metres east of the centre (negative = south/west).
const offset = ([lat, lng], north, east) => ({
    type: "Point",
    coordinates: [
        +(lng + east / (METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180))).toFixed(6),
        +(lat + north / METERS_PER_DEGREE).toFixed(6)
    ]
});

const around = (lat, lng) => ({
    centre: offset([lat, lng], 0, 0),
    at: (north, east) => offset([lat, lng], north, east)
});

const sst = around(12.8452, 77.6602);
const iitd = around(28.545, 77.1926);
const demo = around(12.9716, 77.5946);

const campuses = [
    {
        name: "Scaler School of Technology",
        shortName: "SST",
        slug: "sst",
        city: "Bengaluru",
        emailDomains: ["sst.scaler.com"],
        location: sst.centre,
        hostels: [
            { name: "Hostel Block A", location: sst.at(220, -140) },
            { name: "Hostel Block B", location: sst.at(260, 90) },
            { name: "Girls Hostel", location: sst.at(-180, 210) }
        ],
        safeSpots: [
            { name: "Main Gate Security Desk", description: "Guards on duty 24×7", location: sst.at(-120, -60) },
            { name: "Library Entrance", description: "CCTV covered, busy all day", location: sst.at(40, 30) },
            { name: "Cafeteria", description: "Grab a chai while you trade", location: sst.at(90, -40) },
            { name: "Academic Block Lobby", description: "Open during class hours", location: sst.at(10, 80) }
        ]
    },
    {
        name: "Indian Institute of Technology Delhi",
        shortName: "IIT Delhi",
        slug: "iitd",
        city: "New Delhi",
        emailDomains: ["iitd.ac.in"],
        location: iitd.centre,
        hostels: [
            { name: "Aravali", location: iitd.at(420, 310) },
            { name: "Girnar", location: iitd.at(380, 420) },
            { name: "Kumaon", location: iitd.at(470, 120) },
            { name: "Nilgiri", location: iitd.at(520, 240) },
            { name: "Himadri", location: iitd.at(-260, 520) }
        ],
        safeSpots: [
            { name: "Main Gate", description: "Security post at the entrance", location: iitd.at(-420, -180) },
            { name: "Central Library", description: "CCTV covered, open late", location: iitd.at(60, 20) },
            { name: "Student Activity Centre (SAC)", description: "Always busy in the evenings", location: iitd.at(250, 330) },
            { name: "Lecture Hall Complex", description: "Open during class hours", location: iitd.at(-40, -90) }
        ]
    },
    {
        // For local testing and the demo accounts in Chunk 7. In development, OTP codes are
        // printed in the backend terminal, so any name@campusswap.dev email works.
        name: "CampusSwap Demo University",
        shortName: "Demo U",
        slug: "demo",
        city: "Bengaluru",
        emailDomains: ["campusswap.dev"],
        location: demo.centre,
        hostels: [
            { name: "Alpha Hostel", location: demo.at(300, -200) },
            { name: "Beta Hostel", location: demo.at(350, 150) },
            { name: "Gamma Hostel", location: demo.at(-250, 300) }
        ],
        safeSpots: [
            { name: "Main Gate", description: "Security desk, open 24×7", location: demo.at(-200, -100) },
            { name: "Library", description: "CCTV covered", location: demo.at(50, 0) },
            { name: "Food Court", description: "Crowded at lunch, great for handovers", location: demo.at(120, 160) }
        ]
    }
];

export default campuses;
