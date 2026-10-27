// The people and listings that `npm run seed:demo` (scripts/seedDemo.js) puts on the demo campus
// (CampusSwap Demo University in campuses.data.js). What happens between them (chats, offers, deals,
// reviews) is played out in the script itself.

// `joined`: days since they signed up (trust grows with account age). `seen`: hours since they were
// last online. buyer@ and seller@ are the public demo logins; nobody logs in as the others.
export const people = {
    buyer: {
        email: "buyer@campusswap.dev",
        name: "Aarav Mehta",
        hostel: "Alpha Hostel",
        bio: "2nd year CSE. Always on the lookout for good second-hand books and gear.",
        joined: 74,
        seen: 1
    },
    seller: {
        email: "seller@campusswap.dev",
        name: "Diya Sharma",
        hostel: "Beta Hostel",
        bio: "Final year ECE, clearing out my room before placements. Happy to meet at the library.",
        joined: 132,
        seen: 0.4
    },
    rohan: {
        email: "rohan@campusswap.dev",
        name: "Rohan Iyer",
        hostel: "Gamma Hostel",
        bio: "Maths minor. Cricket every evening 🏏",
        joined: 96,
        seen: 3
    },
    ananya: {
        email: "ananya@campusswap.dev",
        name: "Ananya Reddy",
        hostel: "Alpha Hostel",
        bio: "Music club lead. I rent out my guitar when I'm not jamming.",
        joined: 118,
        seen: 5
    },
    kabir: {
        email: "kabir@campusswap.dev",
        name: "Kabir Singh",
        hostel: "Beta Hostel",
        bio: "The hostel's tech guy: monitors, speakers, chargers.",
        joined: 61,
        seen: 9
    },
    ishita: {
        email: "ishita@campusswap.dev",
        name: "Ishita Banerjee",
        hostel: "Gamma Hostel",
        bio: "Design student. Passing on things I don't use any more.",
        joined: 88,
        seen: 2
    },
    vikram: {
        email: "vikram@campusswap.dev",
        name: "Vikram Nair",
        hostel: "Alpha Hostel",
        bio: "Fresher, setting up my room on a budget.",
        joined: 45,
        seen: 4
    },
    priya: {
        email: "priya@campusswap.dev",
        name: "Priya Menon",
        hostel: "Beta Hostel",
        bio: "Runner, reader, notes-maker.",
        joined: 103,
        seen: 26
    }
};

// A campus admin of the demo campus only (no hostel: their location is the campus centre).
export const admin = {
    email: "admin@campusswap.dev",
    name: "Demo Admin",
    hostel: "",
    bio: "Keeps the demo campus tidy.",
    joined: 140,
    seen: 30
};

// `seller` is a key of `people`. `image` is a picture in frontend/public/demo (served at /demo/<image>.svg).
// `posted`: days ago. The other fields are exactly what the sell form sends.
export const listings = {
    headphones: {
        seller: "seller",
        image: "headphones",
        posted: 6,
        views: 38,
        type: "sell",
        title: "boAt Rockerz 450 wireless headphones",
        description: "About 15 hours of battery on a charge. New ear cushions last month, comes with the charging cable. Selling because I got a new pair as a gift.",
        category: "electronics",
        condition: "like-new",
        price: 900
    },
    cycle: {
        seller: "seller",
        image: "cycle",
        posted: 4,
        views: 52,
        type: "sell",
        title: "Hero Sprint 26T cycle (21 gears)",
        description: "Serviced last month: new brake pads and tyres. Perfect for the ride to the academic block. Lock and key included.",
        category: "cycles",
        condition: "good",
        price: 3500
    },
    calculator: {
        seller: "seller",
        image: "calculator",
        posted: 20,
        views: 61,
        type: "sell",
        title: "Casio fx-991ES Plus calculator",
        description: "Allowed in every exam. Works perfectly and comes with its hard cover.",
        category: "electronics",
        condition: "good",
        price: 600
    },
    eceKit: {
        seller: "seller",
        image: "kit",
        posted: 9,
        views: 27,
        type: "kit",
        title: "1st-year ECE semester kit",
        description: "Everything I used in first year. The books have a few highlights, the rest is in great shape.",
        category: "books",
        condition: "good",
        price: 1200,
        kitItems: [
            "Basic Electrical Engineering (B.L. Theraja)",
            "Higher Engineering Mathematics (B.S. Grewal)",
            "Mini drafter + set squares",
            "4 lab record notebooks"
        ]
    },
    labCoat: {
        seller: "seller",
        image: "lab-coat",
        posted: 2,
        views: 14,
        type: "free",
        title: "Lab coat (size M)",
        description: "Used for one semester of chemistry lab, washed and ironed. Free to anyone who needs it!",
        category: "lab",
        condition: "good"
    },
    drafter: {
        seller: "buyer",
        image: "drafter",
        posted: 3,
        views: 19,
        type: "wanted",
        title: "Wanted: mini drafter for Engineering Graphics",
        description: "Need a working mini drafter before next week's ED lab. Any brand is fine.",
        category: "lab",
        price: 300
    },
    osBook: {
        seller: "buyer",
        image: "os-book",
        posted: 8,
        views: 33,
        type: "swap",
        title: "Galvin OS book (9th ed.), swap for a DBMS book",
        description: "Operating System Concepts by Galvin, 9th edition. Clean copy, no markings.",
        category: "books",
        condition: "like-new",
        swapFor: "Korth's Database System Concepts (any edition)"
    },
    clrs: {
        seller: "rohan",
        image: "clrs",
        posted: 11,
        views: 74,
        type: "sell",
        title: "Introduction to Algorithms (CLRS), 3rd ed.",
        description: "The DSA bible. A few pencil notes in the graph chapters, otherwise like new.",
        category: "books",
        condition: "good",
        price: 450
    },
    cricketBat: {
        seller: "rohan",
        image: "cricket-bat",
        posted: 13,
        views: 29,
        type: "sell",
        title: "SG English willow cricket bat",
        description: "Full size, knocked in and oiled, new grip. Selling because I switched to a lighter bat.",
        category: "sports",
        condition: "good",
        price: 1800
    },
    guitar: {
        seller: "ananya",
        image: "guitar",
        posted: 16,
        views: 45,
        type: "rent",
        title: "Yamaha F310 acoustic guitar",
        description: "Great for beginners and hostel jam sessions. Comes with a gig bag and a capo.",
        category: "other",
        condition: "good",
        price: 150,
        rentPeriod: "week",
        negotiable: false
    },
    plant: {
        seller: "ananya",
        image: "plant",
        posted: 5,
        views: 21,
        type: "sell",
        title: "Indoor plant in a ceramic pot",
        description: "Easy to look after: water it twice a week. Brightens up any hostel room.",
        category: "hostel",
        condition: "good",
        price: 250
    },
    umbrella: {
        seller: "ananya",
        image: "umbrella",
        posted: 1,
        views: 9,
        type: "free",
        title: "Big umbrella, free",
        description: "Found two in my cupboard and I only need one. Monsoon-ready!",
        category: "other",
        condition: "good"
    },
    monitor: {
        seller: "kabir",
        image: "monitor",
        posted: 7,
        views: 88,
        type: "sell",
        title: "Dell 24-inch monitor (P2419H)",
        description: "Full HD IPS panel, height-adjustable stand, HDMI cable included. No dead pixels.",
        category: "electronics",
        condition: "like-new",
        price: 7500
    },
    speaker: {
        seller: "kabir",
        image: "speaker",
        posted: 10,
        views: 40,
        type: "rent",
        title: "JBL Flip 5 Bluetooth speaker",
        description: "Loud, waterproof and lasts all night. Perfect for hostel parties and fest practice.",
        category: "electronics",
        condition: "good",
        price: 100,
        rentPeriod: "day"
    },
    // The one with the open report waiting for the admin.
    iron: {
        seller: "kabir",
        image: "iron",
        posted: 2,
        views: 17,
        type: "sell",
        title: "Philips steam iron (sealed box)",
        description: "Brand new, never opened. Pay on UPI first to book it.",
        category: "hostel",
        condition: "new",
        price: 499,
        negotiable: false
    },
    cooler: {
        seller: "ishita",
        image: "cooler",
        posted: 12,
        views: 57,
        type: "sell",
        title: "Bajaj 20L personal room cooler",
        description: "Keeps a single room cool all summer. Tank cleaned, works perfectly.",
        category: "hostel",
        condition: "good",
        price: 2800
    },
    racquet: {
        seller: "ishita",
        image: "badminton",
        posted: 6,
        views: 23,
        type: "swap",
        title: "Yonex badminton racquet, up for a swap",
        description: "Yonex Muscle Power 29, strung at 24 lbs. Barely used since I joined the dance club.",
        category: "sports",
        condition: "good",
        swapFor: "A cricket bat or a football"
    },
    moveInKit: {
        seller: "ishita",
        image: "bucket",
        posted: 14,
        views: 36,
        type: "kit",
        title: "Hostel move-in kit",
        description: "Everything a fresher needs on day one, in one go.",
        category: "hostel",
        condition: "good",
        price: 700,
        kitItems: ["Bucket and mug", "4-socket extension board", "Clothes iron", "Mattress protector"]
    },
    laptopStand: {
        seller: "vikram",
        image: "laptop-stand",
        posted: 5,
        views: 26,
        type: "sell",
        title: "Adjustable aluminium laptop stand",
        description: "Six height levels and folds flat. Fixed my neck pain during late-night coding.",
        category: "electronics",
        condition: "like-new",
        price: 650
    },
    extensionBoard: {
        seller: "vikram",
        image: "extension-board",
        posted: 1,
        views: 8,
        type: "wanted",
        title: "Wanted: extension board with surge protection",
        description: "At least 4 sockets and a long cable, for my room.",
        category: "hostel",
        price: 300
    },
    shoes: {
        seller: "priya",
        image: "shoes",
        posted: 9,
        views: 31,
        type: "sell",
        title: "Nike Revolution running shoes (UK 7)",
        description: "About two months of morning runs. Clean and comfy, just a size too small for me.",
        category: "clothing",
        condition: "good",
        price: 1500
    },
    notes: {
        seller: "priya",
        image: "notes",
        posted: 4,
        views: 47,
        type: "free",
        title: "DBMS handwritten notes (Sem 4)",
        description: "Neat notes for the whole syllabus, with solved previous-year questions. Free for juniors!",
        category: "books",
        condition: "good"
    }
};

// [who, which listing, days ago]: hearts on the listings' Save buttons.
export const saves = [
    ["buyer", "monitor", 5],
    ["buyer", "clrs", 7],
    ["buyer", "cooler", 2],
    ["buyer", "headphones", 4],
    ["seller", "shoes", 4],
    ["seller", "laptopStand", 3],
    ["rohan", "cycle", 2],
    ["rohan", "speaker", 8],
    ["vikram", "cycle", 1],
    ["priya", "eceKit", 3],
    ["ishita", "plant", 4]
];
