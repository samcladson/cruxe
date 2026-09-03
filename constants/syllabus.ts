import { SyllabusTopic } from "./syllabusTypes";

/**
 * syllabus.ts — what the app teaches.
 *
 * Each entry names a subject a puzzle can be built from. The generator picks
 * the least-recently-used topic for a category, pairs it with one of its
 * angles, and asks Gemini for words drawn from that brief. Title and
 * standfirst ship exactly as written here — the model never authors them, so
 * a malformed response costs a puzzle its facts and never its title.
 *
 * Weighted towards subjects that reward being taught — how a thing works, why
 * it mattered — over trivia that merely tests recall. Current affairs are
 * deliberately absent: they would go stale in a checked-in file, and the
 * generator's prompt already carries the date and asks for topical
 * vocabulary.
 *
 * Adding a topic: pick a stable slug id, keep the title within 30 characters
 * and naming rather than describing, and give it angles distinct enough to
 * produce genuinely different puzzles. `__tests__/syllabus.test.ts` enforces
 * the mechanical rules.
 */
export const SYLLABUS: SyllabusTopic[] = [
  // ═══════════════════════════════════════════════════════════════════
  // GENERAL — how the world works. Language, science, earth, ideas.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "how-words-are-borrowed",
    category: "general",
    title: "Words English Stole",
    standfirst:
      "English has borrowed from over 350 languages. The receipts are still visible in the spelling.",
    angles: ["borrowings from French", "borrowings from Arabic and Hindi", "borrowings from Norse and Dutch"],
  },
  {
    id: "the-periodic-table",
    category: "general",
    title: "The Periodic Table",
    standfirst:
      "Mendeleev left gaps for elements nobody had found yet, then described them in advance.",
    angles: ["the noble gases", "metals that shaped industry", "elements named after places"],
  },
  {
    id: "plate-tectonics",
    category: "general",
    title: "Plate Tectonics",
    standfirst:
      "The ground is a set of rafts. Everything dramatic in geology happens at their edges.",
    angles: ["the Ring of Fire", "how mountains are built", "continental drift's evidence"],
  },
  {
    id: "the-water-cycle",
    category: "general",
    title: "The Water Cycle",
    standfirst:
      "Every drop you drink has been through the sky, a river and a living thing before.",
    angles: ["evaporation and clouds", "rivers and watersheds", "groundwater and aquifers"],
  },
  {
    id: "how-vaccines-work",
    category: "general",
    title: "How Vaccines Work",
    standfirst:
      "A vaccine is a rehearsal. The immune system meets a threat under conditions it can win.",
    angles: ["the immune response", "types of vaccine", "eradication campaigns"],
  },
  {
    id: "the-scientific-method",
    category: "general",
    title: "The Scientific Method",
    standfirst:
      "Its power is not that it finds truth, but that it is designed to catch its own mistakes.",
    angles: ["hypothesis and falsification", "controls and blinding", "peer review and replication"],
  },
  {
    id: "clouds-and-weather",
    category: "general",
    title: "Reading the Clouds",
    standfirst:
      "Cloud shapes are a forecast written in the sky, and the vocabulary is Latin.",
    angles: ["cloud classification", "storm formation", "fronts and pressure systems"],
  },
  {
    id: "the-human-eye",
    category: "general",
    title: "The Human Eye",
    standfirst:
      "An organ that builds an image from upside-down light, and a brain that quietly corrects it.",
    angles: ["the optics of sight", "colour vision", "common vision defects"],
  },
  {
    id: "dna-and-heredity",
    category: "general",
    title: "DNA and Heredity",
    standfirst:
      "Four letters, repeated three billion times, spelling out an entire organism.",
    angles: ["the structure of DNA", "genes and inheritance", "mutation and variation"],
  },
  {
    id: "the-carbon-cycle",
    category: "general",
    title: "The Carbon Cycle",
    standfirst:
      "Carbon moves between air, ocean, rock and life on timescales from days to aeons.",
    angles: ["photosynthesis and respiration", "oceans as a carbon sink", "fossil carbon"],
  },
  {
    id: "measuring-time",
    category: "general",
    title: "Measuring Time",
    standfirst:
      "From sundials to caesium atoms, every clock is an argument about what a second is.",
    angles: ["ancient timekeeping", "the mechanical clock", "atomic time and leap seconds"],
  },
  {
    id: "the-worlds-oceans",
    category: "general",
    title: "The World's Oceans",
    standfirst:
      "Seventy percent of the planet, and better mapped from orbit than from the surface.",
    angles: ["ocean currents", "the deep sea", "coral reefs"],
  },
  {
    id: "optical-illusions",
    category: "general",
    title: "Optical Illusions",
    standfirst:
      "Illusions are not failures of sight. They are the shortcuts of vision made visible.",
    angles: ["geometric illusions", "colour and contrast tricks", "depth and perspective"],
  },
  {
    id: "the-alphabet",
    category: "general",
    title: "Where Letters Came From",
    standfirst:
      "The letter A began as an ox's head, upside down, in a Sinai mine.",
    angles: ["Phoenician origins", "Greek and Latin scripts", "writing systems beyond the alphabet"],
  },
  {
    id: "volcanoes",
    category: "general",
    title: "Volcanoes",
    standfirst:
      "Not one phenomenon but several, and the difference decides whether you can outrun it.",
    angles: ["types of eruption", "famous eruptions", "volcanic landforms"],
  },
  {
    id: "the-nervous-system",
    category: "general",
    title: "The Nervous System",
    standfirst:
      "Electricity and chemistry, running a body at roughly the power of a dim light bulb.",
    angles: ["neurons and signals", "the brain's regions", "reflexes and the spinal cord"],
  },
  {
    id: "navigation-before-gps",
    category: "general",
    title: "Navigating Without GPS",
    standfirst:
      "Finding longitude at sea was the hardest technical problem of the eighteenth century.",
    angles: ["celestial navigation", "the longitude problem", "maps and projections"],
  },
  {
    id: "the-immune-system",
    category: "general",
    title: "The Immune System",
    standfirst:
      "A defence with no central command that still tells you apart from everything else.",
    angles: ["innate defences", "antibodies and memory", "allergies and autoimmunity"],
  },
  {
    id: "renewable-energy",
    category: "general",
    title: "Renewable Energy",
    standfirst:
      "Every renewable source is sunlight in disguise, except the two that are not.",
    angles: ["solar and wind", "hydro and geothermal", "storage and the grid"],
  },
  {
    id: "animal-migration",
    category: "general",
    title: "Animal Migration",
    standfirst:
      "Some animals navigate by magnetic field, some by smell, some by stars they have never been taught.",
    angles: ["bird migration", "ocean migrations", "how animals navigate"],
  },
  {
    id: "the-solar-system",
    category: "general",
    title: "The Solar System",
    standfirst:
      "Eight planets, one star, and a great deal of ice we only recently learned to look for.",
    angles: ["the rocky planets", "gas giants and their moons", "comets and asteroids"],
  },
  {
    id: "fermentation",
    category: "general",
    title: "Fermentation",
    standfirst:
      "Bread, cheese, beer and yoghurt are all the same trick, performed by different microbes.",
    angles: ["bread and beer", "cheese and dairy", "preserved and pickled foods"],
  },
  {
    id: "logical-fallacies",
    category: "general",
    title: "Logical Fallacies",
    standfirst:
      "Arguments that feel convincing and are not. Naming them is most of the defence.",
    angles: ["fallacies of relevance", "statistical fallacies", "rhetoric and persuasion"],
  },
  {
    id: "the-atmosphere",
    category: "general",
    title: "Layers of the Sky",
    standfirst:
      "The atmosphere is thinner relative to Earth than the skin of an apple.",
    angles: ["the troposphere and weather", "the ozone layer", "the edge of space"],
  },
  {
    id: "photosynthesis",
    category: "general",
    title: "Photosynthesis",
    standfirst:
      "The reaction that put oxygen in the air and made every animal after it possible.",
    angles: ["how leaves capture light", "the oxygen catastrophe", "plants that break the rules"],
  },
  {
    id: "great-rivers",
    category: "general",
    title: "The Great Rivers",
    standfirst:
      "Civilisations did not choose rivers. Rivers chose where civilisations could exist.",
    angles: ["rivers of Africa and Asia", "the Amazon basin", "deltas and floodplains"],
  },
  {
    id: "materials-that-changed-us",
    category: "general",
    title: "Materials That Changed Us",
    standfirst:
      "Ages are named after materials for a reason: bronze, iron, steel, silicon.",
    angles: ["metals and alloys", "glass and ceramics", "plastics and polymers"],
  },
  {
    id: "how-flight-works",
    category: "general",
    title: "How Flight Works",
    standfirst:
      "Lift is not one explanation but two, and both are needed to get the sums right.",
    angles: ["aerodynamics of a wing", "birds and insects", "balloons and airships"],
  },
  {
    id: "colour",
    category: "general",
    title: "The Science of Colour",
    standfirst:
      "Colour is not a property of objects. It is what happens when light meets an eye.",
    angles: ["light and wavelength", "pigments and dyes", "colour in nature"],
  },
  {
    id: "symbiosis",
    category: "general",
    title: "Symbiosis",
    standfirst:
      "Lichens are not organisms but partnerships. So, arguably, are you.",
    angles: ["mutual partnerships", "parasites and hosts", "the microbiome"],
  },
  {
    id: "the-metric-system",
    category: "general",
    title: "The Metric System",
    standfirst:
      "A metre was once a fraction of the Earth. Now it is defined by the speed of light.",
    angles: ["origins of the metre", "SI base units", "units the world kept anyway"],
  },
  {
    id: "deserts",
    category: "general",
    title: "Deserts",
    standfirst:
      "Defined by rainfall, not heat — which is why Antarctica is one.",
    angles: ["hot deserts", "cold and polar deserts", "life adapted to drought"],
  },
  {
    id: "sound-and-hearing",
    category: "general",
    title: "Sound and Hearing",
    standfirst:
      "Pressure waves in air, converted to nerve signals by the smallest bones you own.",
    angles: ["how the ear works", "acoustics and resonance", "ultrasound and infrasound"],
  },
  {
    id: "forests",
    category: "general",
    title: "Forests of the World",
    standfirst:
      "Trees communicate through fungal networks, which is stranger than it first sounds.",
    angles: ["rainforest ecology", "boreal and temperate forests", "trees and fungi"],
  },
  {
    id: "probability",
    category: "general",
    title: "Chance and Probability",
    standfirst:
      "Human intuition about randomness is reliably wrong, and casinos are built on that.",
    angles: ["odds and expectation", "famous probability puzzles", "randomness in nature"],
  },
  {
    id: "the-earths-interior",
    category: "general",
    title: "Inside the Earth",
    standfirst:
      "Nobody has drilled past the crust. Everything below is known from earthquakes.",
    angles: ["crust, mantle and core", "seismic waves", "the magnetic field"],
  },
  {
    id: "domesticated-animals",
    category: "general",
    title: "Domesticated Animals",
    standfirst:
      "Domestication changed both species. Dogs read human faces better than wolves ever could.",
    angles: ["dogs and cats", "livestock and agriculture", "the horse"],
  },
  {
    id: "bridges",
    category: "general",
    title: "How Bridges Stand Up",
    standfirst:
      "Four basic forms, each solving the same problem with a different distribution of force.",
    angles: ["arch and beam bridges", "suspension bridges", "famous crossings"],
  },
  {
    id: "the-seasons",
    category: "general",
    title: "Why Seasons Happen",
    standfirst:
      "Not distance from the Sun — tilt. The Earth is nearest the Sun in January.",
    angles: ["axial tilt and solstices", "seasons around the world", "calendars and equinoxes"],
  },
  {
    id: "antibiotics",
    category: "general",
    title: "Antibiotics",
    standfirst:
      "Discovered by accident, and now being lost to the evolution they set in motion.",
    angles: ["penicillin's discovery", "how antibiotics work", "resistance"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY — what happened, and why it still shapes things.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "the-silk-road",
    category: "history",
    title: "The Silk Road",
    standfirst:
      "Not one road, and it carried religions, plagues and inventions further than it carried silk.",
    angles: ["the trade routes", "goods and ideas exchanged", "the cities it built"],
  },
  {
    id: "ancient-egypt",
    category: "history",
    title: "Ancient Egypt",
    standfirst:
      "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
    angles: ["pyramids and pharaohs", "hieroglyphs and the Rosetta Stone", "daily life on the Nile"],
  },
  {
    id: "the-roman-republic",
    category: "history",
    title: "The Roman Republic",
    standfirst:
      "A constitution built to prevent kings, dismantled by the men it made powerful.",
    angles: ["republican institutions", "the Punic Wars", "the fall into empire"],
  },
  {
    id: "the-printing-press",
    category: "history",
    title: "The Printing Press",
    standfirst:
      "Gutenberg's real invention was movable type in metal, and it ended a monopoly on knowledge.",
    angles: ["Gutenberg's workshop", "the spread of literacy", "print and the Reformation"],
  },
  {
    id: "the-industrial-revolution",
    category: "history",
    title: "The Industrial Revolution",
    standfirst:
      "The first time in history that ordinary living standards rose within a single lifetime.",
    angles: ["steam and coal", "textiles and factories", "railways"],
  },
  {
    id: "the-age-of-sail",
    category: "history",
    title: "The Age of Sail",
    standfirst:
      "Three centuries in which the fastest way to move anything was to catch the wind.",
    angles: ["ships and rigging", "exploration voyages", "life aboard"],
  },
  {
    id: "the-black-death",
    category: "history",
    title: "The Black Death",
    standfirst:
      "It killed perhaps half of Europe, and the survivors' wages rose for a century after.",
    angles: ["the plague's spread", "medieval medicine", "social consequences"],
  },
  {
    id: "the-renaissance",
    category: "history",
    title: "The Renaissance",
    standfirst:
      "A rediscovery of the ancient world that produced something entirely unlike it.",
    angles: ["Florence and its patrons", "art and perspective", "science and anatomy"],
  },
  {
    id: "the-french-revolution",
    category: "history",
    title: "The French Revolution",
    standfirst:
      "It invented the political vocabulary — left, right, terror, citizen — we still argue in.",
    angles: ["causes and the estates", "the Terror", "Napoleon's rise"],
  },
  {
    id: "the-american-revolution",
    category: "history",
    title: "The American Revolution",
    standfirst:
      "A tax dispute that became an argument about where authority comes from at all.",
    angles: ["causes and grievances", "the war", "the constitution that followed"],
  },
  {
    id: "the-mongol-empire",
    category: "history",
    title: "The Mongol Empire",
    standfirst:
      "The largest contiguous empire ever assembled, built by people with no cities.",
    angles: ["Genghis Khan's conquests", "the Pax Mongolica", "the empire's fragmentation"],
  },
  {
    id: "ancient-greece",
    category: "history",
    title: "Ancient Greece",
    standfirst:
      "A few hundred thousand people who set the agenda for philosophy, drama and politics.",
    angles: ["Athens and democracy", "Sparta and warfare", "philosophy and its schools"],
  },
  {
    id: "the-ottoman-empire",
    category: "history",
    title: "The Ottoman Empire",
    standfirst:
      "Six centuries spanning three continents, and a bureaucracy that outlasted its armies.",
    angles: ["rise and conquest", "administration and culture", "the long decline"],
  },
  {
    id: "the-cold-war",
    category: "history",
    title: "The Cold War",
    standfirst:
      "Two systems that never fought each other directly, and fought everywhere else.",
    angles: ["the arms race", "proxy conflicts", "the Berlin Wall"],
  },
  {
    id: "the-space-race",
    category: "history",
    title: "The Space Race",
    standfirst:
      "A rivalry that put twelve people on the Moon in under a decade, then stopped.",
    angles: ["Sputnik and Gagarin", "the Apollo programme", "the shuttle era"],
  },
  {
    id: "the-suffrage-movement",
    category: "history",
    title: "The Fight for the Vote",
    standfirst:
      "Universal suffrage is younger than the telephone, and was conceded rather than granted.",
    angles: ["the suffragettes", "civil rights and voting", "expansions of the franchise"],
  },
  {
    id: "the-library-of-alexandria",
    category: "history",
    title: "Libraries of the Ancient World",
    standfirst:
      "Alexandria did not burn down in a night. It was defunded, slowly, over centuries.",
    angles: ["Alexandria", "Baghdad's House of Wisdom", "monastic preservation"],
  },
  {
    id: "the-maya",
    category: "history",
    title: "The Maya",
    standfirst:
      "They calculated a solar year more accurately than Europe would for another thousand years.",
    angles: ["cities and architecture", "calendar and astronomy", "writing and collapse"],
  },
  {
    id: "the-vikings",
    category: "history",
    title: "The Vikings",
    standfirst:
      "Traders and settlers far more often than raiders, and in North America before Columbus.",
    angles: ["ships and navigation", "settlement and trade", "myth and sagas"],
  },
  {
    id: "the-silk-and-spice-trade",
    category: "history",
    title: "The Spice Trade",
    standfirst:
      "Nutmeg grew on a handful of islands, and Europe went round the world to reach them.",
    angles: ["spices and their sources", "the trading companies", "voyages of exploration"],
  },
  {
    id: "world-war-one",
    category: "history",
    title: "The First World War",
    standfirst:
      "Industrial capacity met nineteenth-century tactics, and the result was four years of stalemate.",
    angles: ["causes and alliances", "trench warfare", "the peace and its consequences"],
  },
  {
    id: "world-war-two",
    category: "history",
    title: "The Second World War",
    standfirst:
      "The deadliest conflict in history, and the origin of most institutions that followed it.",
    angles: ["the European theatre", "the Pacific war", "the home fronts"],
  },
  {
    id: "decolonisation",
    category: "history",
    title: "The End of Empires",
    standfirst:
      "Within thirty years of 1945, most of the world's people changed which flag governed them.",
    angles: ["independence movements", "partition and borders", "the Commonwealth and after"],
  },
  {
    id: "the-silk-of-china",
    category: "history",
    title: "Imperial China",
    standfirst:
      "Paper, printing, the compass and gunpowder, all exported long before Europe had them.",
    angles: ["the dynasties", "inventions and technology", "the Great Wall and the canal"],
  },
  {
    id: "the-enlightenment",
    category: "history",
    title: "The Enlightenment",
    standfirst:
      "The argument that reason, not authority, should settle questions — and its limits.",
    angles: ["philosophers and salons", "science and reason", "its political legacy"],
  },
  {
    id: "medieval-castles",
    category: "history",
    title: "Castles",
    standfirst:
      "Every feature was an answer to a specific way of being attacked.",
    angles: ["castle architecture", "siege warfare", "life inside"],
  },
  {
    id: "the-abolition-of-slavery",
    category: "history",
    title: "Abolition",
    standfirst:
      "A moral argument that took a century to win, and economics that resisted it throughout.",
    angles: ["the transatlantic trade", "abolition movements", "emancipation and after"],
  },
  {
    id: "the-gold-rushes",
    category: "history",
    title: "The Gold Rushes",
    standfirst:
      "Most prospectors left poorer. The people selling shovels did rather well.",
    angles: ["California and the Klondike", "Australia and South Africa", "boomtowns"],
  },
  {
    id: "ancient-mesopotamia",
    category: "history",
    title: "Mesopotamia",
    standfirst:
      "Writing began as accountancy. The first texts are receipts for barley and beer.",
    angles: ["Sumer and cuneiform", "law and Hammurabi", "cities and irrigation"],
  },
  {
    id: "the-plague-of-cities",
    category: "history",
    title: "The Rise of Cities",
    standfirst:
      "For most of history cities killed more people than they produced, and grew anyway.",
    angles: ["ancient cities", "sanitation and public health", "the modern metropolis"],
  },
  {
    id: "cartography",
    category: "history",
    title: "The History of Maps",
    standfirst:
      "Every map is a lie of some kind. The skill is choosing which lie is useful.",
    angles: ["early world maps", "projections and distortion", "surveying the empire"],
  },
  {
    id: "the-samurai",
    category: "history",
    title: "Feudal Japan",
    standfirst:
      "Two and a half centuries of near-total isolation, ended by four American ships.",
    angles: ["the samurai and shogunate", "isolation and the Edo period", "the Meiji Restoration"],
  },
  {
    id: "the-inca",
    category: "history",
    title: "The Inca Empire",
    standfirst:
      "Thousands of miles of road, administered without writing, money or the wheel.",
    angles: ["roads and administration", "Machu Picchu and building", "conquest and collapse"],
  },
  {
    id: "the-history-of-money",
    category: "history",
    title: "The History of Money",
    standfirst:
      "Credit came before coins. Debt is older than currency by several thousand years.",
    angles: ["barter, coins and credit", "banking's origins", "paper money and inflation"],
  },
  {
    id: "great-fires-and-rebuilding",
    category: "history",
    title: "Cities That Burned",
    standfirst:
      "London, Chicago, Lisbon — catastrophes that rewrote how cities are built.",
    angles: ["the Great Fire of London", "earthquakes and rebuilding", "fire and building codes"],
  },
  {
    id: "the-history-of-medicine",
    category: "history",
    title: "The History of Medicine",
    standfirst:
      "For most of it, going to a doctor made you statistically more likely to die.",
    angles: ["ancient and medieval medicine", "germ theory", "anaesthesia and surgery"],
  },
  {
    id: "the-hanseatic-league",
    category: "history",
    title: "Merchant Leagues",
    standfirst:
      "A trading alliance of cities that fought wars and set laws without ever being a country.",
    angles: ["the Hanseatic League", "Venice and Genoa", "guilds and trade law"],
  },
  {
    id: "the-agricultural-revolution",
    category: "history",
    title: "The Birth of Farming",
    standfirst:
      "It made civilisation possible and made the people who did it shorter and sicker.",
    angles: ["domesticating crops", "the first settlements", "irrigation and surplus"],
  },
  {
    id: "the-history-of-writing",
    category: "history",
    title: "The Invention of Writing",
    standfirst:
      "Invented independently at least three times, and each time to keep track of property.",
    angles: ["cuneiform and hieroglyphs", "alphabets", "decipherment"],
  },
  {
    id: "exploration-of-the-poles",
    category: "history",
    title: "Polar Exploration",
    standfirst:
      "Amundsen planned for the conditions. Scott planned for the conditions he hoped for.",
    angles: ["the race to the South Pole", "Arctic expeditions", "survival and equipment"],
  },
  {
    id: "the-history-of-the-calendar",
    category: "history",
    title: "Fixing the Calendar",
    standfirst:
      "In 1582 ten days were deleted. Some countries did not agree for another three centuries.",
    angles: ["Julian and Gregorian", "calendars around the world", "leap years and drift"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // TECHNOLOGY — how the modern world is actually built.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "the-apollo-programme",
    category: "technology",
    title: "The Apollo Programme",
    standfirst:
      "Eleven crewed missions, one decade, and computers weaker than a washing machine's.",
    angles: ["the hardware", "the people", "the mission profile"],
  },
  {
    id: "how-the-internet-works",
    category: "technology",
    title: "How the Internet Works",
    standfirst:
      "No one runs it. It works because everyone agreed on how to pass a packet along.",
    angles: ["packets and protocols", "DNS and addressing", "cables and infrastructure"],
  },
  {
    id: "encryption",
    category: "technology",
    title: "Encryption",
    standfirst:
      "Public-key cryptography lets two strangers agree a secret in public, and it feels impossible.",
    angles: ["ciphers through history", "public-key cryptography", "hashing and signatures"],
  },
  {
    id: "the-transistor",
    category: "technology",
    title: "The Transistor",
    standfirst:
      "The most manufactured object in history. There are more of them than grains of sand.",
    angles: ["how a transistor works", "the integrated circuit", "Moore's law"],
  },
  {
    id: "machine-learning",
    category: "technology",
    title: "How Machines Learn",
    standfirst:
      "A neural network is not programmed with rules. It is shown examples until it infers them.",
    angles: ["neural networks", "training and data", "where models fail"],
  },
  {
    id: "gps",
    category: "technology",
    title: "How GPS Works",
    standfirst:
      "Your phone finds itself by measuring how late four satellites' clocks appear to be.",
    angles: ["satellites and timing", "relativity's role", "other positioning systems"],
  },
  {
    id: "the-electric-grid",
    category: "technology",
    title: "The Electric Grid",
    standfirst:
      "Supply must match demand every second, everywhere, or the whole thing falls over.",
    angles: ["generation and transmission", "balancing the load", "storage and renewables"],
  },
  {
    id: "batteries",
    category: "technology",
    title: "How Batteries Work",
    standfirst:
      "Chemistry that runs backwards on demand, and the reason your phone exists in this shape.",
    angles: ["battery chemistry", "lithium-ion", "recycling and materials"],
  },
  {
    id: "semiconductor-manufacturing",
    category: "technology",
    title: "Making a Chip",
    standfirst:
      "Features smaller than a virus, printed with light, in rooms cleaner than an operating theatre.",
    angles: ["lithography", "the fabrication process", "the global supply chain"],
  },
  {
    id: "the-jet-engine",
    category: "technology",
    title: "The Jet Engine",
    standfirst:
      "Suck, squeeze, bang, blow — four words that describe a machine of extraordinary precision.",
    angles: ["how a turbofan works", "the engine's invention", "materials and heat"],
  },
  {
    id: "radio",
    category: "technology",
    title: "Radio",
    standfirst:
      "The first technology to make distance irrelevant, and the foundation of every wireless thing since.",
    angles: ["waves and modulation", "broadcasting's rise", "radar and beyond"],
  },
  {
    id: "the-camera",
    category: "technology",
    title: "The Camera",
    standfirst:
      "From a darkened room with a pinhole to a sensor counting individual photons.",
    angles: ["optics and exposure", "film and chemistry", "digital sensors"],
  },
  {
    id: "programming-languages",
    category: "technology",
    title: "Programming Languages",
    standfirst:
      "Every one is a compromise between what humans can read and what machines can run.",
    angles: ["early languages", "paradigms", "compilers and interpreters"],
  },
  {
    id: "robotics",
    category: "technology",
    title: "Robotics",
    standfirst:
      "The hard problems are not thinking or moving. They are seeing and gripping.",
    angles: ["industrial robots", "sensing and control", "autonomy and navigation"],
  },
  {
    id: "the-telephone-network",
    category: "technology",
    title: "The Telephone Network",
    standfirst:
      "A century of switching technology, from women at plugboards to packets on fibre.",
    angles: ["switching and exchanges", "undersea cables", "mobile networks"],
  },
  {
    id: "3d-printing",
    category: "technology",
    title: "Additive Manufacturing",
    standfirst:
      "Making things by adding material rather than cutting it away changes what shapes are possible.",
    angles: ["printing processes", "materials", "industrial and medical uses"],
  },
  {
    id: "quantum-computing",
    category: "technology",
    title: "Quantum Computing",
    standfirst:
      "Not a faster computer. A different kind, good at a small and strange set of problems.",
    angles: ["qubits and superposition", "error correction", "what it is actually for"],
  },
  {
    id: "the-web",
    category: "technology",
    title: "The World Wide Web",
    standfirst:
      "Invented to help physicists share papers, and given away rather than patented.",
    angles: ["HTML and hypertext", "browsers and standards", "the web's evolution"],
  },
  {
    id: "satellites",
    category: "technology",
    title: "Satellites",
    standfirst:
      "Orbit is not about height. It is about going sideways fast enough to keep missing the ground.",
    angles: ["types of orbit", "communications satellites", "earth observation"],
  },
  {
    id: "desalination",
    category: "technology",
    title: "Making Seawater Drinkable",
    standfirst:
      "Entire cities now drink the ocean, and the hard part is what to do with the salt.",
    angles: ["reverse osmosis", "thermal distillation", "energy and brine"],
  },
  {
    id: "the-shipping-container",
    category: "technology",
    title: "The Shipping Container",
    standfirst:
      "A steel box that cut the cost of moving goods by more than any engine ever did.",
    angles: ["standardisation", "ports and cranes", "global trade effects"],
  },
  {
    id: "medical-imaging",
    category: "technology",
    title: "Seeing Inside the Body",
    standfirst:
      "X-ray, ultrasound, MRI — three completely different physics, one purpose.",
    angles: ["X-rays and CT", "ultrasound", "MRI"],
  },
  {
    id: "refrigeration",
    category: "technology",
    title: "Refrigeration",
    standfirst:
      "It changed what humans eat, where food is grown, and how cities can be fed.",
    angles: ["the refrigeration cycle", "the cold chain", "refrigerants and ozone"],
  },
  {
    id: "cryptocurrency-and-ledgers",
    category: "technology",
    title: "Distributed Ledgers",
    standfirst:
      "A record no single party controls, kept honest by making dishonesty expensive.",
    angles: ["how a blockchain works", "consensus mechanisms", "energy and scaling"],
  },
  {
    id: "renewable-storage",
    category: "technology",
    title: "Storing Energy",
    standfirst:
      "The sun sets and the wind drops. Storage is what turns renewables into a grid.",
    angles: ["pumped hydro", "grid batteries", "hydrogen and thermal storage"],
  },
  {
    id: "operating-systems",
    category: "technology",
    title: "Operating Systems",
    standfirst:
      "The software whose job is to stop all the other software from interfering with each other.",
    angles: ["processes and memory", "file systems", "the Unix lineage"],
  },
  {
    id: "fibre-optics",
    category: "technology",
    title: "Fibre Optics",
    standfirst:
      "Light bounced down a glass thread, carrying almost all of the internet under the sea.",
    angles: ["total internal reflection", "undersea cable laying", "bandwidth and lasers"],
  },
  {
    id: "vaccine-technology",
    category: "technology",
    title: "mRNA Medicine",
    standfirst:
      "Instead of delivering a drug, it delivers instructions for the body to make one.",
    angles: ["how mRNA vaccines work", "the cold chain problem", "beyond infectious disease"],
  },
  {
    id: "self-driving-vehicles",
    category: "technology",
    title: "Autonomous Vehicles",
    standfirst:
      "Driving is easy for humans and hard for machines, for reasons that took decades to understand.",
    angles: ["sensors and lidar", "levels of autonomy", "edge cases and safety"],
  },
  {
    id: "recycling-technology",
    category: "technology",
    title: "How Recycling Works",
    standfirst:
      "Sorting is the whole problem, and contamination is why so much of it fails.",
    angles: ["sorting and processing", "plastics and their codes", "metals and glass"],
  },
  {
    id: "nuclear-power",
    category: "technology",
    title: "Nuclear Power",
    standfirst:
      "Boiling water with the most concentrated energy source humans have ever controlled.",
    angles: ["fission and reactors", "waste and safety", "fusion research"],
  },
  {
    id: "displays",
    category: "technology",
    title: "Screens",
    standfirst:
      "Cathode rays, liquid crystals, then organic diodes — three ways to fake a moving image.",
    angles: ["CRT to LCD", "OLED and micro-LED", "resolution and colour"],
  },
  {
    id: "search-engines",
    category: "technology",
    title: "How Search Works",
    standfirst:
      "Crawling, indexing, ranking — and the ranking is where all the difficulty lives.",
    angles: ["crawling and indexing", "ranking and relevance", "the economics of search"],
  },
  {
    id: "compression",
    category: "technology",
    title: "Data Compression",
    standfirst:
      "Some of it is reversible and some throws information away, and you rarely notice which.",
    angles: ["lossless compression", "images and video", "audio and psychoacoustics"],
  },
  {
    id: "sensors",
    category: "technology",
    title: "Sensors Everywhere",
    standfirst:
      "A modern phone contains more instruments than a mid-century laboratory.",
    angles: ["accelerometers and gyroscopes", "optical and chemical sensors", "the internet of things"],
  },
  {
    id: "agriculture-technology",
    category: "technology",
    title: "Farming Technology",
    standfirst:
      "Half the people alive are fed by nitrogen pulled from the air by one industrial process.",
    angles: ["the Haber process", "mechanisation", "precision agriculture"],
  },
  {
    id: "space-telescopes",
    category: "technology",
    title: "Space Telescopes",
    standfirst:
      "Putting a mirror above the atmosphere removes the one thing no optics can correct for.",
    angles: ["Hubble and its repair", "infrared astronomy", "how images are built"],
  },
  {
    id: "wireless-standards",
    category: "technology",
    title: "Wi-Fi and Bluetooth",
    standfirst:
      "Two solutions to the same crowded slice of spectrum, optimised for opposite problems.",
    angles: ["radio spectrum sharing", "Wi-Fi generations", "short-range protocols"],
  },
  {
    id: "brain-computer-interfaces",
    category: "technology",
    title: "Brain-Computer Interfaces",
    standfirst:
      "Reading intention directly from neural signals, now in genuine clinical trials.",
    angles: ["recording neural signals", "medical applications", "the open problems"],
  },
  {
    id: "computer-memory",
    category: "technology",
    title: "Computer Memory",
    standfirst:
      "A hierarchy from registers to disk, each level a hundred times slower and cheaper.",
    angles: ["RAM and caches", "solid-state storage", "the memory hierarchy"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENTERTAINMENT — how culture gets made, and how it works.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "how-films-are-made",
    category: "entertainment",
    title: "How Films Are Made",
    standfirst:
      "Most of a film is decided in an edit suite, long after everyone has gone home.",
    angles: ["pre-production and crew", "cinematography", "editing and post"],
  },
  {
    id: "film-genres",
    category: "entertainment",
    title: "Film Genres",
    standfirst:
      "Genre is a promise to the audience about what kind of ending to expect.",
    angles: ["noir and thrillers", "westerns", "science fiction on screen"],
  },
  {
    id: "the-orchestra",
    category: "entertainment",
    title: "The Orchestra",
    standfirst:
      "Four families of instrument, arranged so that the quietest can still be heard.",
    angles: ["the instrument families", "conductors and scores", "the symphony's evolution"],
  },
  {
    id: "shakespeare",
    category: "entertainment",
    title: "Shakespeare",
    standfirst:
      "He coined or first recorded well over a thousand words still in ordinary use.",
    angles: ["the tragedies", "the comedies", "the Globe and Elizabethan theatre"],
  },
  {
    id: "animation",
    category: "entertainment",
    title: "Animation",
    standfirst:
      "Twelve principles, written in the 1930s, that still govern how animated motion reads.",
    angles: ["hand-drawn techniques", "stop motion", "computer animation"],
  },
  {
    id: "music-theory",
    category: "entertainment",
    title: "How Music Works",
    standfirst:
      "Scales, keys and chords are a shared grammar that most listeners know without being taught.",
    angles: ["scales and keys", "rhythm and metre", "harmony and chords"],
  },
  {
    id: "the-history-of-jazz",
    category: "entertainment",
    title: "Jazz",
    standfirst:
      "An American art form built on improvisation, where the mistakes became the vocabulary.",
    angles: ["New Orleans origins", "bebop and after", "the great players"],
  },
  {
    id: "video-game-design",
    category: "entertainment",
    title: "Game Design",
    standfirst:
      "A good game teaches you its rules without ever appearing to explain them.",
    angles: ["mechanics and feedback loops", "level design", "the industry's history"],
  },
  {
    id: "theatre",
    category: "entertainment",
    title: "The Theatre",
    standfirst:
      "The oldest surviving mass medium, and the only one where the audience can be heard back.",
    angles: ["Greek and Roman drama", "stagecraft", "musicals"],
  },
  {
    id: "photography-as-art",
    category: "entertainment",
    title: "Photography",
    standfirst:
      "It took painting's job away, and in doing so freed painting to become something else.",
    angles: ["composition and light", "documentary photography", "the great photographers"],
  },
  {
    id: "the-novel",
    category: "entertainment",
    title: "The Novel",
    standfirst:
      "A form barely three centuries old that reshaped how people imagine other minds.",
    angles: ["the novel's origins", "the great realists", "modernism and after"],
  },
  {
    id: "broadcast-television",
    category: "entertainment",
    title: "Television",
    standfirst:
      "From three channels to infinite ones, and the storytelling changed at every step.",
    angles: ["the broadcast era", "the sitcom and the serial", "streaming and prestige TV"],
  },
  {
    id: "opera",
    category: "entertainment",
    title: "Opera",
    standfirst:
      "Invented as an attempt to reconstruct how Greek drama might have been sung.",
    angles: ["the great composers", "voice types", "famous works"],
  },
  {
    id: "comics",
    category: "entertainment",
    title: "Comics and Graphic Novels",
    standfirst:
      "The gutter between panels is where the reader does the work, and that is the medium.",
    angles: ["the superhero tradition", "manga", "the graphic novel"],
  },
  {
    id: "dance",
    category: "entertainment",
    title: "Dance",
    standfirst:
      "Ballet's vocabulary is French because a king who liked dancing standardised it.",
    angles: ["ballet", "modern and contemporary", "social and folk dance"],
  },
  {
    id: "the-recording-studio",
    category: "entertainment",
    title: "The Recording Studio",
    standfirst:
      "Multitrack recording turned a performance into something that could be built.",
    angles: ["microphones and acoustics", "multitrack and mixing", "producers who changed sound"],
  },
  {
    id: "special-effects",
    category: "entertainment",
    title: "Special Effects",
    standfirst:
      "The best effects are the ones nobody notices, which is why practical work survives.",
    angles: ["practical effects", "computer imagery", "motion capture"],
  },
  {
    id: "the-blues",
    category: "entertainment",
    title: "The Blues",
    standfirst:
      "Twelve bars and three chords that became the foundation of most popular music since.",
    angles: ["Delta origins", "electric blues", "its influence on rock"],
  },
  {
    id: "world-cinema",
    category: "entertainment",
    title: "World Cinema",
    standfirst:
      "National film industries that developed their own grammar rather than importing one.",
    angles: ["Japanese cinema", "Indian cinema", "European new waves"],
  },
  {
    id: "podcasting-and-radio-drama",
    category: "entertainment",
    title: "Audio Storytelling",
    standfirst:
      "Radio drama never died. It changed its name and found a much bigger audience.",
    angles: ["radio's golden age", "sound design", "the podcast era"],
  },
  {
    id: "architecture-as-culture",
    category: "entertainment",
    title: "Architecture",
    standfirst:
      "The one art form you cannot avoid experiencing, whatever you think of it.",
    angles: ["classical orders", "modernism", "famous buildings"],
  },
  {
    id: "poetry",
    category: "entertainment",
    title: "Poetry",
    standfirst:
      "Metre and rhyme began as memory aids, back when poems had to be carried in heads.",
    angles: ["forms and metre", "the Romantics", "modern poetry"],
  },
  {
    id: "fashion",
    category: "entertainment",
    title: "Fashion",
    standfirst:
      "Clothing signals faster than speech, which is why every subculture has a uniform.",
    angles: ["couture and designers", "textiles and construction", "subcultural style"],
  },
  {
    id: "the-art-museum",
    category: "entertainment",
    title: "Painting",
    standfirst:
      "Oil paint let artists revise, and revision is what made the Renaissance portrait possible.",
    angles: ["Renaissance masters", "Impressionism", "modern movements"],
  },
  {
    id: "stand-up-comedy",
    category: "entertainment",
    title: "Comedy",
    standfirst:
      "Timing is not a metaphor. The difference between a laugh and silence is fractions of a second.",
    angles: ["the craft of a joke", "comic traditions", "satire"],
  },
  {
    id: "sculpture",
    category: "entertainment",
    title: "Sculpture",
    standfirst:
      "Carving removes and modelling adds, and the choice shapes everything that follows.",
    angles: ["classical sculpture", "materials and casting", "modern and public sculpture"],
  },
  {
    id: "the-music-industry",
    category: "entertainment",
    title: "The Music Business",
    standfirst:
      "Formats decided the music: three minutes because that is what a shellac disc held.",
    angles: ["formats and their limits", "labels and publishing", "streaming economics"],
  },
  {
    id: "folklore",
    category: "entertainment",
    title: "Folklore and Myth",
    standfirst:
      "The same handful of stories recur across cultures that never met.",
    angles: ["Greek and Norse myth", "folk tales", "modern retellings"],
  },
  {
    id: "documentary",
    category: "entertainment",
    title: "Documentary",
    standfirst:
      "Every documentary is an argument, and the editing is where the argument is made.",
    angles: ["the form's history", "styles and ethics", "landmark films"],
  },
  {
    id: "electronic-music",
    category: "entertainment",
    title: "Electronic Music",
    standfirst:
      "Instruments that never existed, built by people who wanted sounds nobody had heard.",
    angles: ["synthesisers", "sampling and hip-hop", "dance music genres"],
  },
  {
    id: "the-western-canon",
    category: "entertainment",
    title: "Classic Literature",
    standfirst:
      "Books that stayed in print for centuries, which is a harder test than any prize.",
    angles: ["epics and antiquity", "the nineteenth century", "twentieth-century classics"],
  },
  {
    id: "screenwriting",
    category: "entertainment",
    title: "Screenwriting",
    standfirst:
      "Structure is not formula. It is a prediction about when an audience gets restless.",
    angles: ["structure and acts", "dialogue and character", "adaptation"],
  },
  {
    id: "puppetry",
    category: "entertainment",
    title: "Puppetry",
    standfirst:
      "An ancient form that survives because audiences will believe anything that moves correctly.",
    angles: ["traditions around the world", "techniques", "puppetry on screen"],
  },
  {
    id: "festivals",
    category: "entertainment",
    title: "Festivals",
    standfirst:
      "Gatherings that mark the calendar, and increasingly the economy of the towns that host them.",
    angles: ["music festivals", "film festivals", "traditional celebrations"],
  },
  {
    id: "the-circus",
    category: "entertainment",
    title: "Circus and Spectacle",
    standfirst:
      "The modern circus began as a trick-riding show in a ring sized for a cantering horse.",
    angles: ["circus arts", "the modern circus", "magic and illusion"],
  },
  {
    id: "science-fiction",
    category: "entertainment",
    title: "Science Fiction",
    standfirst:
      "It is rarely about the future. It is about the present, moved somewhere it can be examined.",
    angles: ["the golden age", "dystopias", "science fiction on screen"],
  },
  {
    id: "voice-acting",
    category: "entertainment",
    title: "Voice Performance",
    standfirst:
      "A performance with everything stripped away except timing, pitch and breath.",
    angles: ["animation voices", "dubbing and localisation", "audiobooks and narration"],
  },
  {
    id: "album-art",
    category: "entertainment",
    title: "Graphic Design",
    standfirst:
      "Typography is invisible when it works, which makes it the hardest kind of design to notice.",
    angles: ["typography", "posters and album art", "branding and identity"],
  },
  {
    id: "improvisation",
    category: "entertainment",
    title: "Improvisation",
    standfirst:
      "A discipline with strict rules, all of which exist to make invention possible.",
    angles: ["improv theatre", "musical improvisation", "its influence on scripted work"],
  },
  {
    id: "food-culture",
    category: "entertainment",
    title: "Culinary Traditions",
    standfirst:
      "National cuisines are mostly younger than the nations, and built from imported ingredients.",
    angles: ["regional cuisines", "techniques and equipment", "restaurants and chefs"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // SPORTS — the rules, the physics, and the people.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "the-olympic-games",
    category: "sports",
    title: "The Olympic Games",
    standfirst:
      "Revived in 1896 by a French aristocrat who thought British schoolboys had the right idea.",
    angles: ["ancient and modern origins", "the summer games", "the winter games"],
  },
  {
    id: "football-tactics",
    category: "sports",
    title: "Football Tactics",
    standfirst:
      "Formations are not shapes. They are arguments about where space will appear.",
    angles: ["formations through history", "pressing and possession", "the World Cup"],
  },
  {
    id: "cricket",
    category: "sports",
    title: "Cricket",
    standfirst:
      "The only major sport where the condition of the ground is part of the contest.",
    angles: ["the formats", "batting and bowling craft", "the great rivalries"],
  },
  {
    id: "athletics",
    category: "sports",
    title: "Track and Field",
    standfirst:
      "The oldest events in sport, and the ones where progress is measured in hundredths.",
    angles: ["sprints and relays", "distance running", "field events"],
  },
  {
    id: "the-marathon",
    category: "sports",
    title: "The Marathon",
    standfirst:
      "The distance is 26.2 miles because of where the royal box was in 1908.",
    angles: ["the distance's origin", "training and physiology", "the great marathons"],
  },
  {
    id: "tennis",
    category: "sports",
    title: "Tennis",
    standfirst:
      "Four surfaces, four majors, and a scoring system nobody can quite explain the origin of.",
    angles: ["the grand slams", "surfaces and styles", "the great rivalries"],
  },
  {
    id: "basketball",
    category: "sports",
    title: "Basketball",
    standfirst:
      "Invented in a fortnight to keep students occupied indoors during a New England winter.",
    angles: ["the game's invention", "positions and tactics", "the modern era"],
  },
  {
    id: "cycling",
    category: "sports",
    title: "Road Cycling",
    standfirst:
      "A sport where the strongest rider often loses, because drafting rewards patience.",
    angles: ["the grand tours", "tactics and teamwork", "the machines"],
  },
  {
    id: "swimming",
    category: "sports",
    title: "Swimming",
    standfirst:
      "Water is 800 times denser than air, so technique matters more than power.",
    angles: ["the four strokes", "open water swimming", "records and technique"],
  },
  {
    id: "rugby",
    category: "sports",
    title: "Rugby",
    standfirst:
      "Two codes, one origin, split over whether working men could be paid to play.",
    angles: ["union and league", "the set piece", "international competition"],
  },
  {
    id: "motorsport",
    category: "sports",
    title: "Motorsport",
    standfirst:
      "Aerodynamic downforce lets a car corner harder than gravity should permit.",
    angles: ["Formula One", "endurance racing", "rallying"],
  },
  {
    id: "boxing",
    category: "sports",
    title: "Boxing",
    standfirst:
      "The Queensberry rules turned a brawl into a sport, mostly by introducing gloves and rounds.",
    angles: ["the rules and weight classes", "great fights", "styles and technique"],
  },
  {
    id: "golf",
    category: "sports",
    title: "Golf",
    standfirst:
      "The only sport played on a surface where no two venues are the same shape.",
    angles: ["the majors", "course design", "equipment and technique"],
  },
  {
    id: "gymnastics",
    category: "sports",
    title: "Gymnastics",
    standfirst:
      "Scoring was rebuilt from scratch after a perfect ten stopped being able to separate anyone.",
    angles: ["the apparatus", "scoring and difficulty", "famous routines"],
  },
  {
    id: "winter-sports",
    category: "sports",
    title: "Winter Sports",
    standfirst:
      "Sports invented by people who needed to travel over snow and decided to race instead.",
    angles: ["skiing disciplines", "skating", "sliding sports"],
  },
  {
    id: "baseball",
    category: "sports",
    title: "Baseball",
    standfirst:
      "The only major sport with no clock, where the defence holds the ball.",
    angles: ["the rules and positions", "pitching craft", "statistics and analytics"],
  },
  {
    id: "sports-physiology",
    category: "sports",
    title: "The Athlete's Body",
    standfirst:
      "Two muscle fibre types, and which you have more of decides what you will be good at.",
    angles: ["muscle and energy systems", "training principles", "recovery and injury"],
  },
  {
    id: "sailing",
    category: "sports",
    title: "Competitive Sailing",
    standfirst:
      "A sailing boat can travel faster than the wind pushing it, which sounds like cheating.",
    angles: ["how sailing upwind works", "the America's Cup", "ocean racing"],
  },
  {
    id: "climbing",
    category: "sports",
    title: "Climbing",
    standfirst:
      "Grading systems are the sport's shared language, and no two countries use the same one.",
    angles: ["disciplines and grades", "great ascents", "equipment and safety"],
  },
  {
    id: "chess",
    category: "sports",
    title: "Chess",
    standfirst:
      "More possible games than atoms in the observable universe, from thirty-two pieces.",
    angles: ["openings and strategy", "world championships", "computers and chess"],
  },
  {
    id: "hockey",
    category: "sports",
    title: "Hockey",
    standfirst:
      "Field and ice, two sports with a shared ancestor and almost nothing else in common.",
    angles: ["field hockey", "ice hockey", "tactics and positions"],
  },
  {
    id: "combat-sports",
    category: "sports",
    title: "Martial Arts",
    standfirst:
      "Every style is a set of answers to the question of what happens at a particular distance.",
    angles: ["grappling arts", "striking arts", "Olympic combat sports"],
  },
  {
    id: "the-world-cup",
    category: "sports",
    title: "Football's World Cup",
    standfirst:
      "The most watched recurring event on Earth, and older than most of the countries in it.",
    angles: ["memorable tournaments", "great goals and players", "hosting and qualification"],
  },
  {
    id: "sports-equipment",
    category: "sports",
    title: "Sports Equipment",
    standfirst:
      "Records fall when materials change, which is why governing bodies regulate them so tightly.",
    angles: ["materials and design", "banned innovations", "footwear and technology"],
  },
  {
    id: "the-paralympics",
    category: "sports",
    title: "The Paralympics",
    standfirst:
      "Begun as rehabilitation for spinal injuries at a British hospital in 1948.",
    angles: ["origins and growth", "classification", "the sports and their adaptations"],
  },
  {
    id: "endurance-events",
    category: "sports",
    title: "Endurance Racing",
    standfirst:
      "Beyond a certain distance the limiting factor stops being muscle and becomes fuel.",
    angles: ["triathlon", "ultra distance", "fuelling and pacing"],
  },
  {
    id: "sports-officiating",
    category: "sports",
    title: "Refereeing",
    standfirst:
      "Technology has not removed judgement from sport. It has moved where the judgement happens.",
    angles: ["the laws and their interpretation", "video review", "famous controversies"],
  },
  {
    id: "athletics-records",
    category: "sports",
    title: "Records and Their Limits",
    standfirst:
      "Progress in most events has slowed to a crawl, which tells you something about the ceiling.",
    angles: ["how records progressed", "the physiological limits", "conditions and legality"],
  },
  {
    id: "stadiums",
    category: "sports",
    title: "Great Stadiums",
    standfirst:
      "Designed for sightlines, evacuation and acoustics, in roughly that order.",
    angles: ["famous venues", "design and engineering", "atmosphere and crowds"],
  },
  {
    id: "sports-and-society",
    category: "sports",
    title: "Sport and Society",
    standfirst:
      "Sport has broken social barriers and reinforced them, sometimes in the same decade.",
    angles: ["breaking barriers", "sport and politics", "amateurism and money"],
  },
  {
    id: "table-sports",
    category: "sports",
    title: "Racket and Table Sports",
    standfirst:
      "Table tennis balls leave the bat with more spin than any other ball in sport.",
    angles: ["table tennis", "badminton and squash", "spin and technique"],
  },
  {
    id: "horse-racing",
    category: "sports",
    title: "Equestrian Sport",
    standfirst:
      "Nearly every thoroughbred racing today descends from three stallions.",
    angles: ["flat and jump racing", "eventing and dressage", "breeding and bloodlines"],
  },
  {
    id: "sports-coaching",
    category: "sports",
    title: "Coaching",
    standfirst:
      "The best coaches change what a sport considers possible, not just who wins.",
    angles: ["famous coaches", "tactics and innovation", "team culture"],
  },
  {
    id: "extreme-sports",
    category: "sports",
    title: "Extreme Sports",
    standfirst:
      "Disciplines that grew out of subcultures and ended up in the Olympic programme.",
    angles: ["skateboarding and BMX", "surfing", "snowboarding and freestyle"],
  },
  {
    id: "team-sport-strategy",
    category: "sports",
    title: "Strategy in Team Sport",
    standfirst:
      "Every team sport is a negotiation about space, time and where to concentrate players.",
    angles: ["attacking systems", "defensive structures", "set pieces"],
  },
  {
    id: "sports-broadcasting",
    category: "sports",
    title: "Sport on Television",
    standfirst:
      "Broadcast money did not just fund sport. It rewrote its rules, formats and calendars.",
    angles: ["the broadcast revolution", "camera work and replay", "commentary"],
  },
  {
    id: "youth-and-grassroots",
    category: "sports",
    title: "Grassroots Sport",
    standfirst:
      "Elite success is mostly a function of how many children get a decent first coach.",
    angles: ["talent development", "academies and pathways", "participation and access"],
  },
  {
    id: "doping",
    category: "sports",
    title: "Doping and Fair Play",
    standfirst:
      "Testing has always trailed the chemistry, which is why storing samples for years matters.",
    angles: ["the history of doping", "testing and enforcement", "landmark cases"],
  },
  {
    id: "archery-and-shooting",
    category: "sports",
    title: "Precision Sports",
    standfirst:
      "Sports where the heartbeat is the largest source of error, and breathing is technique.",
    angles: ["archery", "shooting disciplines", "darts and snooker"],
  },
  {
    id: "rowing",
    category: "sports",
    title: "Rowing",
    standfirst:
      "Eight people must apply force within hundredths of a second of each other, or the boat slows.",
    angles: ["boat classes and rigging", "the great regattas", "technique and training"],
  },
];
