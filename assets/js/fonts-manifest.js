/* Curated FIGlet font catalogue for generateascii.com.
   `file` matches assets/fonts/<file>.flf exactly (case + spaces). */
const FONT_CATALOGUE = [
  { file: "Standard",       category: "Classic" },
  { file: "Big",            category: "Classic" },
  { file: "Small",          category: "Classic" },
  { file: "Mini",           category: "Classic" },
  { file: "Term",           category: "Classic" },
  { file: "Short",          category: "Classic" },
  { file: "Thin",           category: "Classic" },
  { file: "Calvin S",       category: "Classic" },

  { file: "Block",          category: "Block" },
  { file: "Blocks",         category: "Block" },
  { file: "Doom",           category: "Block" },
  { file: "Colossal",       category: "Block" },
  { file: "Broadway",       category: "Block" },
  { file: "Bulbhead",       category: "Block" },
  { file: "Chunky",         category: "Block" },
  { file: "Rectangles",     category: "Block" },
  { file: "Univers",        category: "Block" },

  { file: "ANSI Shadow",    category: "3D" },
  { file: "ANSI Regular",   category: "3D" },
  { file: "Banner3-D",      category: "3D" },
  { file: "Larry 3D",       category: "3D" },
  { file: "Isometric1",     category: "3D" },
  { file: "3D-ASCII",       category: "3D" },
  { file: "3D Diagonal",    category: "3D" },
  { file: "Henry 3D",       category: "3D" },

  { file: "Slant",          category: "Slant" },
  { file: "Small Slant",    category: "Slant" },
  { file: "Speed",          category: "Slant" },
  { file: "Rozzo",          category: "Slant" },

  { file: "Cyberlarge",     category: "Tech" },
  { file: "Cybermedium",    category: "Tech" },
  { file: "Electronic",     category: "Tech" },
  { file: "Digital",        category: "Tech" },
  { file: "LCD",            category: "Tech" },
  { file: "Ghost",          category: "Tech" },
  { file: "Sub-Zero",       category: "Tech" },
  { file: "Star Wars",      category: "Tech" },
  { file: "Trek",           category: "Tech" },
  { file: "Tubular",        category: "Tech" },

  { file: "Graffiti",       category: "Decorative" },
  { file: "Gothic",         category: "Decorative" },
  { file: "Fraktur",        category: "Decorative" },
  { file: "Script",         category: "Decorative" },
  { file: "Cursive",        category: "Decorative" },
  { file: "NV Script",      category: "Decorative" },
  { file: "Puffy",          category: "Decorative" },
  { file: "Shadow",         category: "Decorative" },
  { file: "Stampatello",    category: "Decorative" },
  { file: "Tanja",          category: "Decorative" },
  { file: "Weird",          category: "Decorative" },
  { file: "Wavy",           category: "Decorative" },

  { file: "Bloody",         category: "Novelty" },
  { file: "Fire Font-k",    category: "Novelty" },
  { file: "Ogre",           category: "Novelty" },
  { file: "Poison",         category: "Novelty" },
  { file: "USA Flag",       category: "Novelty" },
  { file: "Crazy",          category: "Novelty" },
  { file: "Epic",           category: "Novelty" },
  { file: "Runic",          category: "Novelty" },
];

/* Shown in the live gallery on first load, before the user searches/filters. */
const GALLERY_DEFAULT_FONTS = [
  "Standard", "ANSI Shadow", "Big", "Slant", "Doom", "Block",
  "Small Slant", "Larry 3D", "Ghost", "Graffiti", "Star Wars", "Colossal",
];

const DEFAULT_FONT = "Standard";
