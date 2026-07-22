export interface LyricRhyme {
  word: string;
  rhymes: string[];
}

export const THEMATIC_RHYMES: Record<string, LyricRhyme[]> = {
  'Midnight City': [
    { word: 'light', rhymes: ['night', 'bright', 'flight', 'neon sight'] },
    { word: 'street', rhymes: ['beat', 'heat', 'meet', 'concrete'] },
    { word: 'glow', rhymes: ['slow', 'shadow', 'below', 'radio'] },
    { word: 'drive', rhymes: ['alive', 'survive', 'five', 'revive'] }
  ],
  'Lost Love': [
    { word: 'heart', rhymes: ['part', 'start', 'apart', 'fine art'] },
    { word: 'tears', rhymes: ['years', 'fears', 'appears', 'gears'] },
    { word: 'name', rhymes: ['flame', 'blame', 'same', 'game'] },
    { word: 'gone', rhymes: ['dawn', 'on', 'drawn', 'withdrawn'] }
  ],
  'Galaxy Exploration': [
    { word: 'star', rhymes: ['far', 'radar', 'sonar', 'pulsar'] },
    { word: 'space', rhymes: ['place', 'trace', 'pace', 'embrace'] },
    { word: 'sky', rhymes: ['high', 'fly', 'why', 'orbit eye'] },
    { word: 'light', rhymes: ['night', 'flight', 'satellite', 'infinite height'] }
  ],
  'Morning Coffee': [
    { word: 'cup', rhymes: ['up', 'wakeup', 'fillup', 'backup'] },
    { word: 'steam', rhymes: ['dream', 'gleam', 'beam', 'cream'] },
    { word: 'warm', rhymes: ['storm', 'form', 'norm', 'reform'] },
    { word: 'slow', rhymes: ['grow', 'glow', 'flow', 'morning show'] }
  ],
  'Cyberpunk Future': [
    { word: 'wire', rhymes: ['fire', 'desire', 'higher', 'amplifier'] },
    { word: 'grid', rhymes: ['hid', 'cyberkid', 'slid', 'forbid'] },
    { word: 'screen', rhymes: ['machine', 'green', 'dream', 'sub-routine'] },
    { word: 'code', rhymes: ['mode', 'node', 'road', 'overload'] }
  ],
  'Ocean Waves': [
    { word: 'sea', rhymes: ['free', 'plea', 'tide key', 'melody'] },
    { word: 'shore', rhymes: ['more', 'roar', 'explore', 'ocean floor'] },
    { word: 'blue', rhymes: ['true', 'hue', 'dew', 'through'] },
    { word: 'tide', rhymes: ['ride', 'wide', 'guide', 'glide'] }
  ],
  'Digital Dreams': [
    { word: 'byte', rhymes: ['light', 'night', 'flight', 'satellite'] },
    { word: 'sound', rhymes: ['around', 'found', 'ground', 'surround'] },
    { word: 'mind', rhymes: ['find', 'rewind', 'behind', 'aligned'] },
    { word: 'tape', rhymes: ['escape', 'shape', 'landscape', 'videotape'] }
  ],
  'Summer Sunset': [
    { word: 'sun', rhymes: ['done', 'run', 'fun', 'one'] },
    { word: 'breeze', rhymes: ['trees', 'seas', 'ease', 'degrees'] },
    { word: 'gold', rhymes: ['old', 'bold', 'cold', 'untold'] },
    { word: 'sky', rhymes: ['high', 'fly', 'by', 'warm goodbye'] }
  ],
  'Neon Rain': [
    { word: 'rain', rhymes: ['pain', 'drain', 'lane', 'train'] },
    { word: 'drop', rhymes: ['stop', 'shop', 'pop', 'rooftop'] },
    { word: 'light', rhymes: ['night', 'sight', 'bright', 'neon flight'] },
    { word: 'street', rhymes: ['beat', 'sheet', 'fleet', 'wet concrete'] }
  ],
  'Deep Space': [
    { word: 'void', rhymes: ['asteroid', 'annoyed', 'destroyed', 'employed'] },
    { word: 'beam', rhymes: ['dream', 'stream', 'gleam', 'laser scheme'] },
    { word: 'dark', rhymes: ['spark', 'mark', 'arc', 'boarding bark'] },
    { word: 'lone', rhymes: ['stone', 'zone', 'home', 'silicon drone'] }
  ],
  'Ancient Ruins': [
    { word: 'stone', rhymes: ['bone', 'alone', 'throne', 'overgrown'] },
    { word: 'dust', rhymes: ['trust', 'must', 'rust', 'wind gust'] },
    { word: 'past', rhymes: ['last', 'fast', 'cast', 'shadow vast'] },
    { word: 'wall', rhymes: ['fall', 'hall', 'call', 'echoes small'] }
  ],
  'Mountain Peak': [
    { word: 'high', rhymes: ['sky', 'fly', 'by', 'eagle eye'] },
    { word: 'snow', rhymes: ['blow', 'glow', 'below', 'valleys low'] },
    { word: 'peak', rhymes: ['seek', 'weak', 'speak', 'mystique'] },
    { word: 'cold', rhymes: ['bold', 'gold', 'fold', 'untold'] }
  ],
  'Urban Jungle': [
    { word: 'wall', rhymes: ['fall', 'call', 'hall', 'skyscrapers tall'] },
    { word: 'beat', rhymes: ['street', 'heat', 'feet', 'concrete'] },
    { word: 'crowd', rhymes: ['loud', 'proud', 'cloud', 'underground shroud'] },
    { word: 'wire', rhymes: ['fire', 'desire', 'higher', 'telephone wire'] }
  ],
  'Time Travel': [
    { word: 'year', rhymes: ['near', 'hear', 'clear', 'yesteryear'] },
    { word: 'past', rhymes: ['last', 'fast', 'cast', 'future cast'] },
    { word: 'clock', rhymes: ['lock', 'dock', 'shock', 'tick-tock'] },
    { word: 'time', rhymes: ['rhyme', 'chime', 'sublime', 'lifeline'] }
  ],
  'Winter Solstice': [
    { word: 'ice', rhymes: ['nice', 'device', 'crystal slice', 'dice'] },
    { word: 'frost', rhymes: ['lost', 'cost', 'crossed', 'winds embossed'] },
    { word: 'dark', rhymes: ['spark', 'bark', 'park', 'solstice arc'] },
    { word: 'cold', rhymes: ['bold', 'old', 'gold', 'winter fold'] }
  ]
};

export const THEMATIC_PHRASES: Record<string, string[]> = {
  'Midnight City': [
    '[0:05] Cruising down the avenue at half past three\n[0:12] Midnight radio plays a forgotten memory',
    '[0:15] Streetlights flicker like stars in the concrete sky\n[0:22] We watch the neon pulse as the world rushes by',
    '[0:30] Golden shadows dance along the storefront glass\n[0:38] Waiting in the silence for the night to pass',
    '[0:45] Engine humming soft, keeping time with the beat\n[0:52] Solitary footsteps on the empty street'
  ],
  'Lost Love': [
    '[0:05] Found an old cassette tape with your favorite song\n[0:12] Static in the audio, where did we go wrong?',
    '[0:15] Left your polaroids sitting by the window frame\n[0:22] The fading colors whisper your forgotten name',
    '[0:30] Rewinding the memories but the tape is worn\n[0:38] Wishing I could stitch back what was slowly torn',
    '[0:45] Echoes of your laughter in an empty room\n[0:52] Shadows on the wall in the twilight gloom'
  ],
  'Galaxy Exploration': [
    '[0:05] Launching sequence starts on the green cathode screen\n[0:12] Floating past the rings that we have never seen',
    '[0:15] Sailing through the cosmos on a solar wind\n[0:22] Leaving all the gravity of Earth behind',
    '[0:30] Counting down the light years till we reach the sun\n[0:38] A journey to the edge that has just begun',
    '[0:45] Signal from the stars on a frequency clear\n[0:52] Whispering secrets that we long to hear'
  ],
  'Morning Coffee': [
    '[0:05] Sunbeams filtering through the dusty window blinds\n[0:12] Morning coffee brewing as the tape rewinds',
    '[0:15] Vapor rising slowly in a spiral track\n[0:22] Simple warm embrace bringing memories back',
    '[0:30] Gentle acoustic guitar strumming soft and low\n[0:38] No need to rush today, let the rhythm flow',
    '[0:45] Cozy kitchen sanctuary, safe and sound\n[0:52] While the spinning record gently goes around'
  ],
  'Cyberpunk Future': [
    '[0:05] High-voltage wires running underneath the skin\n[0:12] Where does the machine stop and my heart begin?',
    '[0:15] Upgraded visual lenses painted neon blue\n[0:22] Sifting through the data searching for the true',
    '[0:30] Glitching interfaces flickering in the dark\n[0:38] Synthesizer pathways ready for the spark',
    '[0:45] Cybernetic city humming with a warning chime\n[0:52] Living on the edge of borrowable time'
  ],
  'Ocean Waves': [
    '[0:05] Saltwater spray kissing our sun-bleached hair\n[0:12] Leaving all our digital worries in the air',
    '[0:15] Horizon stretching out to the infinite blue\n[0:22] Tidal waves of rhythm breaking over you',
    '[0:30] Warm sand sinking under tired feet\n[0:38] Listening to the ocean sing a perfect beat',
    '[0:45] Seagulls crying out in the golden light\n[0:52] Coastal highway driving till the edge of night'
  ],
  'Digital Dreams': [
    '[0:05] Booting up the mainframe in a wash of gray\n[0:12] Loading up the dreams from a simpler day',
    '[0:15] Rhythmic dial-up sounds humming in my mind\n[0:22] A pixelated paradise that we left behind',
    '[0:30] Analog warmth in a cold digital world\n[0:38] Shimmering banners of hope unfurled',
    '[0:45] Floppy disk storage of a summer night\n[0:52] Cathode ray tubes glowing with a soft green light'
  ],
  'Summer Sunset': [
    '[0:05] Windows rolled down, feeling that hot July air\n[0:12] Playlists playing jams without a single care',
    '[0:15] Sky turning purple as the daylight dies\n[0:22] Reflected in the magic of your golden eyes',
    '[0:30] Bonfire crackling on a crowded beach\n[0:38] Grasping at the moments just within our reach',
    '[0:45] Cool night breeze chasing the heat away\n[0:52] Wishing we could freeze this perfect summer day'
  ],
  'Neon Rain': [
    '[0:05] Raindrops falling down on the asphalt street\n[0:12] Reflecting neon signs in a colorful sheet',
    '[0:15] Huddled under awnings from the sudden pour\n[0:22] Music spilling out from an open bar door',
    '[0:30] Shimmering umbrellas drifting in a row\n[0:38] Catching the reflections of the amber glow',
    '[0:45] Raindrops on the glass keeping perfect time\n[0:52] Humming to the rhythm of a midnight chime'
  ],
  'Deep Space': [
    '[0:05] Lost in the static of a deep-space radio band\n[0:12] Driftwood floating in an uncharted land',
    '[0:15] Cosmic radiation painted on the hull\n[0:22] A quiet starry vacuum, peaceful and null',
    '[0:30] Searching for a beacon in the quiet dark\n[0:38] Hoping that our thrusters leave a golden arc',
    '[0:45] Gravity is fading as we float away\n[0:52] Heading for the birthplace of a solar ray'
  ],
  'Ancient Ruins': [
    '[0:05] Overgrown columns rising from the stone\n[0:12] Standing in the silence of a forgotten throne',
    '[0:15] Whispers of the past in the blowing breeze\n[0:22] Rustling through the leaves of the ancient trees',
    '[0:30] Sun sinking low over walls of gray\n[0:38] Relics of a culture that has passed away',
    '[0:45] Mossy patterns carved in the temple door\n[0:52] Secret tunnels winding through the forest floor'
  ],
  'Mountain Peak': [
    '[0:05] Climbing through the mist to the frozen peak\n[0:12] Searching for the answers that we always seek',
    '[0:15] Thin mountain air catching in our chest\n[0:22] Looking down on valleys where the clouds go rest',
    '[0:30] Crimson horizon blazing in the west\n[0:38] Feeling like we finally passed the hardest test',
    '[0:45] Icy winds howling a majestic song\n[0:52] Knowing that this summit is where we belong'
  ],
  'Urban Jungle': [
    '[0:05] High-rise buildings blocking out the sun\n[0:12] Sirens wailing loud as the day is done',
    '[0:15] Subway trains rattling underneath the street\n[0:22] Thousands of people walking to the city beat',
    '[0:30] Steam rising up from a sewer grate\n[0:38] Traffic jams crawling in a sleepy state',
    '[0:45] Neon billboards flashing in the smoggy air\n[0:52] Life on the pavement running everywhere'
  ],
  'Time Travel': [
    '[0:05] Tuning the capacitor to eighty-eight\n[0:12] Racing through the timeline to rewrite our fate',
    '[0:15] Sparks flying off from the metal wheels\n[0:22] Bending all the rules that the science deals',
    '[0:30] Looking at the history of a distant age\n[0:38] Flipping through the chapters of a dusty page',
    '[0:45] Temporal distortion in a warp of blue\n[0:52] Fighting for a future that is bright and true'
  ],
  'Winter Solstice': [
    '[0:05] Silent white blanket covering the ground\n[0:12] Not a single footprint in the woods around',
    '[0:15] Longest night of winter starting to unfold\n[0:22] Breath turning to steam in the biting cold',
    '[0:30] Solitary lantern burning in the dark\n[0:38] Warmth from the fireplace giving off a spark',
    '[0:45] Cozy winter solstice, peaceful and serene\n[0:52] Loveliest landscape that we’ve ever seen'
  ]
};
