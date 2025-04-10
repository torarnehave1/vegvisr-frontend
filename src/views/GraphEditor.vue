<template>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-8" style="height: 100vh">
        <button @click="toggleInfoOnly" style="position: absolute; z-index: 10; margin: 10px">
          {{ infoOnly ? 'Show All' : 'Show Info Only' }}
        </button>
        <div id="cy" style="width: 100%; height: 100%"></div>
      </div>
      <div
        class="col-md-4"
        style="height: 100vh; overflow-y: auto; padding: 20px; border-left: 1px solid #ddd"
      >
        <div v-if="selectedElement">
          <h3>{{ selectedElement.label }}</h3>
          <p v-if="selectedElement.info">
            {{ selectedElement.info }}
          </p>
          <p v-else>No additional information available.</p>
        </div>
        <div v-else>
          <p>Select a node or connection to see details.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue' // <-- import nextTick
import cytoscape from 'cytoscape'

let cyInstance = null
const selectedElement = ref(null)
const infoOnly = ref(false)
const isSubgraphActive = ref(false)
const currentSubDegreeMap = ref(null) // <-- Add this reactive variable

// Subgraph for Yggdrasil
const yggdrasilSubgraph = {
  nodes: [
    { id: 'Roots', label: 'Roots', color: 'saddlebrown' },
    { id: 'Trunk', label: 'Trunk', color: 'peru' },
    { id: 'Branches', label: 'Branches', color: 'forestgreen' },
    { id: 'Asgard', label: 'Asgard', color: 'goldenrod' },
    { id: 'Midgard', label: 'Midgard', color: 'lightblue' },
    { id: 'Hel', label: 'Hel', color: 'gray' },
    { id: 'Norns', label: 'Norns', color: 'violet' },
    { id: 'Urd', label: 'Urd', color: 'lightgreen' },
    { id: 'Verdandi', label: 'Verdandi', color: 'lightgreen' },
    { id: 'Skuld', label: 'Skuld', color: 'lightgreen' },
    { id: 'Yggdrasil', label: 'Yggdrasil', color: 'lightgreen', hasSubgraph: true },
    { id: 'Tree', label: 'Tree', color: 'lightgreen' },
    { id: 'DNA', label: 'DNA', color: 'lightgreen' },
    { id: 'Ouroboros', label: 'Ouroboros', color: 'lightgreen' },
    { id: 'Tridevi', label: 'Tridevi', color: 'deeppink' },
    { id: 'Saraswati', label: 'Saraswati', color: 'lightcoral' },
    { id: 'Lakshmi', label: 'Lakshmi', color: 'lightcoral' },
    { id: 'Parvati', label: 'Parvati', color: 'lightcoral' },
    { id: 'HolyTrinity', label: 'Holy Trinity', color: 'mediumvioletred' },
    { id: 'Father', label: 'Father', color: 'pink' },
    { id: 'Son', label: 'Son', color: 'pink' },
    { id: 'HolySpirit', label: 'Holy Spirit', color: 'pink' },
    // add a node with the syllable AUM and label 'AUM' with the sanscrit letter 'अ'
    {
      id: 'AUM',
      label: 'AUM (ॐ)',
      color: 'orangered',
      type: 'infonode',
      info: 'AUM (अ - ॐ) is a sacred syllable in Hinduism, Buddhism, and Jainism, representing the essence of the ultimate reality or consciousness. It is composed of three phonetic components: "A" (creation), "U" (preservation), and "M" (dissolution). These correspond to the three states of consciousness: waking (A), dreaming (U), and deep sleep (M). Beyond these is "Turia," the fourth state, which signifies pure consciousness or transcendence, the ultimate goal of spiritual practice. AUM encapsulates the entire universe and the journey toward self-realization.',
    },
    {
      id: 'HA',
      label: 'HA (ሐ)',
      color: 'indigo',
      type: 'infonode',
      info: 'The symbol "HA (ሐ)" represents a profound connection between phonetics, spirituality, and metaphysical concepts. In Ethiopian Ge\'ez script, "ሐ" is a sacred character often associated with divine breath and life force. It resonates with the Sanskrit "ह" (HA), symbolizing cosmic energy and the primordial sound. This convergence highlights the universal nature of sacred syllables across cultures, embodying creation, transformation, and unity.',
    },
    { id: 'Hayl', label: 'Hayl (Power)', color: 'orangered' },
    {
      id: 'Haymanot',
      label: 'ሐይማኖት (Haymanot - Faith)',
      color: 'orangered',
      type: 'infonode',
      info: 'Haymanot represents faith, a central concept in Ethiopian Orthodox Christianity and other spiritual traditions.',
    },
    {
      id: 'Hawariyat',
      label: 'Hawariyat (Disciples)',
      color: 'orangered',
      type: 'infonode',
      info: 'Hawariyat refers to the disciples or apostles, often associated with spreading spiritual teachings.',
    },
    //add a node with the sanscrit letter 'ह' and label 'HA'
    {
      id: 'Sanskrit_HA',
      label: 'ह',
      color: 'orangered',
      type: 'infonode',
      info: 'This is the Sanskrit letter HA (ह), representing the divine breath and cosmic energy.',
    },
    //Sanscrit mahamantra
    { id: 'MahaMantra', label: 'महामंत्र', color: 'orangered' },

    //add nodes about the tree brother odin , ve and villi from the Norse mythology
    { id: 'Odin', label: 'Odin', color: 'orangered' },
    { id: 'Vili', label: 'Vili', color: 'orangered' },
    { id: 'Ve', label: 'Ve', color: 'orangered' },

    //add nodes with the tre wells of wisdom
    { id: 'Mimir', label: 'Mimir', color: 'orangered' },
    { id: 'Niflheim', label: 'Niflheim', color: 'orangered' },
    { id: 'Ginnungagap', label: 'Ginnungagap', color: 'orangered' },
    { id: 'Niflheim', label: 'Niflheim', color: 'orangered' },
    { id: 'Ginnungagap', label: 'Ginnungagap', color: 'orangered' },
    { id: 'Helheim', label: 'Helheim', color: 'orangered' },
    { id: 'Vanaheim', label: 'Vanaheim', color: 'orangered' },
    { id: 'Svartalfheim', label: 'Svartalfheim', color: 'orangered' },
    { id: 'Alfheim', label: 'Alfheim', color: 'orangered' },
    { id: 'Jotunheim', label: 'Jotunheim', color: 'orangered' },
    { id: 'Niflheim', label: 'Niflheim', color: 'orangered' },
    { id: 'Ginnungagap', label: 'Ginnungagap', color: 'orangered' },
    { id: 'Helheim', label: 'Helheim', color: 'orangered' },
    { id: 'Vanaheim', label: 'Vanaheim', color: 'orangered' },
    { id: 'Svartalfheim', label: 'Svartalfheim', color: 'orangered' },
    { id: 'Alfheim', label: 'Alfheim', color: 'orangered' },

    //add nodes with the tre wells in yggdrasil Urd, mimir and Hvergelmir
    { id: 'Urd', label: 'Urd', color: 'orangered' },
    { id: 'Mimir', label: 'Mimir', color: 'orangered' },
    {
      id: 'Hvergelmir',
      label: 'Hvergelmir',
      color: 'orangered',
      type: 'infonode',
      info: 'Hvergelmir is one of the three primary wells in Norse mythology, located in Niflheim. It is described as the source of numerous rivers, including Elivaagar, which played a role in the creation of the world. Hvergelmir is also associated with the roots of Yggdrasil, the World Tree, and is guarded by the dragon Nidhoeggr, who gnaws at its roots. This well symbolizes the primordial chaos and the cyclical nature of creation and destruction in Norse cosmology. Sources: Prose Edda by Snorri Sturluson and Poetic Edda.',
    },

    // add a node about udgitha
    {
      id: 'Udgitha',
      label: 'Udgitha',
      color: 'orangered',
      type: 'infonode',
      info: 'Udgitha is a sacred sound in Hinduism, representing the cosmic vibration of the universe. It is associated with the syllable "AUM" and is often used in meditation and chanting practices to connect with the divine and attain spiritual enlightenment.',
    },

    // add a node about Bahvagth
    {
      id: 'Bhagavad Gita',
      label: 'Bhagavad Gita',
      color: 'goldenrod',
      type: 'infonode',
      info: 'The Bhagavad Gita is a 700-verse Hindu scripture that is part of the Indian epic Mahabharata. It is a conversation between Prince Arjuna and the god Krishna, who serves as his charioteer. The Gita addresses the moral and philosophical dilemmas faced by Arjuna on the battlefield and presents key concepts of Hindu philosophy, including dharma (duty), yoga (the path to realization), and devotion.',
    },

    {
      id: 'Hávamál',
      label: 'Hávamál',
      color: 'orangered',
      type: 'infonode',
      info: 'Hávamál, meaning The Sayings of the High One, is a collection of Old Norse poems from the Viking Age. It is part of the Poetic Edda and contains wisdom, advice, and moral teachings attributed to Odin, the chief god in Norse mythology. The text covers various topics, including friendship, hospitality, and the nature of wisdom.',
    },
  ],
  edges: [
    { source: 'Roots', target: 'Trunk' },
    { source: 'Trunk', target: 'Branches' },
    { source: 'Branches', target: 'Asgard' },
    { source: 'Trunk', target: 'Midgard' },
    { source: 'Roots', target: 'Hel' },
    { source: 'Roots', target: 'Norns' },
    { source: 'Norns', target: 'Urd' },
    { source: 'Norns', target: 'Verdandi' },
    { source: 'Norns', target: 'Skuld' },
    { source: 'Yggdrasil', target: 'Tree' },
    { source: 'Yggdrasil', target: 'DNA' },
    { source: 'Yggdrasil', target: 'Ouroboros' },
    { source: 'Tree', target: 'Ouroboros' },
    { source: 'Tree', target: 'DNA' },
    { source: 'Ouroboros', target: 'DNA' },
    { source: 'Asgard', target: 'Yggdrasil' },
    { source: 'Midgard', target: 'Yggdrasil' },
    { source: 'Hel', target: 'Yggdrasil' },
    { source: 'Norns', target: 'Yggdrasil' },
    { source: 'Urd', target: 'Yggdrasil' },
    { source: 'Verdandi', target: 'Yggdrasil' },
    { source: 'Skuld', target: 'Yggdrasil' },
    { source: 'Yggdrasil', target: 'Roots' },
    { source: 'Yggdrasil', target: 'Trunk' },
    { source: 'Yggdrasil', target: 'Branches' },
    { source: 'Yggdrasil', target: 'Asgard' },
    { source: 'Yggdrasil', target: 'Midgard' },
    { source: 'Yggdrasil', target: 'Hel' },
    { source: 'Yggdrasil', target: 'Norns' },
    { source: 'Yggdrasil', target: 'Urd' },
    { source: 'Yggdrasil', target: 'Verdandi' },
    { source: 'Yggdrasil', target: 'Skuld' },
    { source: 'Yggdrasil', target: 'Tree' },
    { source: 'Yggdrasil', target: 'DNA' },
    { source: 'Yggdrasil', target: 'Ouroboros' },
    { source: 'Tree', target: 'Roots' },
    { source: 'Tree', target: 'Trunk' },
    { source: 'Tree', target: 'Branches' },
    { source: 'Tree', target: 'Asgard' },
    { source: 'Tree', target: 'Midgard' },
    { source: 'Tree', target: 'Hel' },
    { source: 'Tree', target: 'Norns' },
    { source: 'Tree', target: 'Urd' },
    { source: 'Tree', target: 'Verdandi' },
    { source: 'Tree', target: 'Skuld' },
    { source: 'DNA', target: 'Roots' },
    { source: 'DNA', target: 'Trunk' },
    { source: 'DNA', target: 'Branches' },
    { source: 'DNA', target: 'Asgard' },
    { source: 'DNA', target: 'Midgard' },
    { source: 'DNA', target: 'Hel' },
    { source: 'DNA', target: 'Norns' },
    { source: 'DNA', target: 'Urd' },
    { source: 'DNA', target: 'Verdandi' },
    { source: 'DNA', target: 'Skuld' },
    { source: 'Ouroboros', target: 'Roots' },
    { source: 'Ouroboros', target: 'Trunk' },
    { source: 'Ouroboros', target: 'Branches' },
    { source: 'Ouroboros', target: 'Asgard' },
    { source: 'Ouroboros', target: 'Midgard' },
    { source: 'Ouroboros', target: 'Hel' },
    { source: 'Ouroboros', target: 'Norns' },
    { source: 'Ouroboros', target: 'Urd' },
    { source: 'Ouroboros', target: 'Verdandi' },
    { source: 'Ouroboros', target: 'Skuld' },
    { source: 'Asgard', target: 'Roots' },
    { source: 'Asgard', target: 'Trunk' },
    { source: 'Asgard', target: 'Branches' },
    { source: 'Midgard', target: 'Roots' },
    { source: 'Midgard', target: 'Trunk' },
    { source: 'Midgard', target: 'Branches' },
    { source: 'Hel', target: 'Roots' },
    { source: 'Hel', target: 'Trunk' },
    { source: 'Hel', target: 'Branches' },

    // Tridevi edges
    { source: 'Tridevi', target: 'Saraswati' },
    { source: 'Tridevi', target: 'Lakshmi' },
    { source: 'Tridevi', target: 'Parvati' },
    { source: 'Saraswati', target: 'Urd' },
    { source: 'Lakshmi', target: 'Verdandi' },
    { source: 'Parvati', target: 'Skuld' },
    { source: 'Tridevi', target: 'Yggdrasil' },
    { source: 'Saraswati', target: 'Tree' },
    { source: 'Lakshmi', target: 'Tree' },
    { source: 'Parvati', target: 'Tree' },
    { source: 'Tridevi', target: 'DNA' },
    { source: 'Tridevi', target: 'Ouroboros' },
    { source: 'Tridevi', target: 'Roots' },
    { source: 'Tridevi', target: 'Branches' },

    // Trinity structure
    { source: 'HolyTrinity', target: 'Father' },
    { source: 'HolyTrinity', target: 'Son' },
    { source: 'HolyTrinity', target: 'HolySpirit' },

    // Convergence into HA
    { source: 'Father', target: 'HA' },
    { source: 'Son', target: 'HA' },
    { source: 'HolySpirit', target: 'HA' },

    // HA giving rise to sacred qualities
    { source: 'HA', target: 'Hayl' },
    { source: 'HA', target: 'Haymanot' },

    // Linking into core metaphysical system
    { source: 'HA', target: 'Yggdrasil' },
    { source: 'Hayl', target: 'Yggdrasil' },
    { source: 'Haymanot', target: 'Yggdrasil' },
    { source: 'HA', target: 'Tree' },
    { source: 'HA', target: 'DNA' },
    { source: 'HA', target: 'Roots' },
    { source: 'Hayl', target: 'Tree' },
    { source: 'Hayl', target: 'DNA' },

    { source: 'Hayl', target: 'Roots' },
    { source: 'Haymanot', target: 'Tree' },
    { source: 'Haymanot', target: 'DNA' },
    { source: 'Haymanot', target: 'Roots' },
    { source: 'Sanskrit_HA', target: 'HA' },
    { source: 'Sanskrit_HA', target: 'Yggdrasil' },
    { source: 'Sanskrit_HA', target: 'Tree' },
    { source: 'Sanskrit_HA', target: 'DNA' },
    { source: 'Sanskrit_HA', target: 'Roots' },

    // AUM connections
    { source: 'AUM', target: 'Sanskrit_HA' },
    { source: 'AUM', target: 'HA' },
    { source: 'AUM', target: 'Yggdrasil' },
    { source: 'AUM', target: 'Tree' },
    { source: 'AUM', target: 'DNA' },
    { source: 'AUM', target: 'Roots' },
    //edges to udgitha
    { source: 'AUM', target: 'Udgitha' },
    { source: 'Udgitha', target: 'Yggdrasil' },
    { source: 'Udgitha', target: 'Tree' },
    { source: 'Udgitha', target: 'DNA' },
    { source: 'Udgitha', target: 'Roots' },
    { source: 'Udgitha', target: 'Ouroboros' },
    { source: 'Udgitha', target: 'Asgard' },
    { source: 'Udgitha', target: 'Midgard' },
    { source: 'Udgitha', target: 'Hel' },
    { source: 'Udgitha', target: 'Norns' },
    { source: 'Udgitha', target: 'Urd' },
    { source: 'Udgitha', target: 'Verdandi' },
    { source: 'Udgitha', target: 'Skuld' },
    { source: 'Udgitha', target: 'Saraswati' },
    { source: 'Udgitha', target: 'Lakshmi' },
    { source: 'Udgitha', target: 'Parvati' },
    { source: 'Udgitha', target: 'HolyTrinity' },
    { source: 'Udgitha', target: 'Father' },
    { source: 'Udgitha', target: 'Son' },
    { source: 'Udgitha', target: 'HolySpirit' },

    //Connect the Holy Trinity to The Norns
    { source: 'HolyTrinity', target: 'Norns' },
    { source: 'Father', target: 'Urd' },
    { source: 'Son', target: 'Verdandi' },
    { source: 'HolySpirit', target: 'Skuld' },
    //Connect the Holy Trinity to The Tridevi
    { source: 'HolyTrinity', target: 'Tridevi' },
    { source: 'Father', target: 'Saraswati' },
    { source: 'Son', target: 'Lakshmi' },
    { source: 'HolySpirit', target: 'Parvati' },

    //connect the tree wells of wisdom to the Yggdrasil
    { source: 'Yggdrasil', target: 'Mimir' },
    { source: 'Yggdrasil', target: 'Hvergelmir' },
    { source: 'Yggdrasil', target: 'Niflheim' },
    { source: 'Yggdrasil', target: 'Ginnungagap' },
    { source: 'Yggdrasil', target: 'Helheim' },
    { source: 'Yggdrasil', target: 'Vanaheim' },
    { source: 'Yggdrasil', target: 'Svartalfheim' },
    { source: 'Yggdrasil', target: 'Alfheim' },
    { source: 'Yggdrasil', target: 'Jotunheim' },
    //urd wellir

    // add edges for the node Bhagavad Gita that is relevant to the hindu traditon
    { source: 'Bhagavad Gita', target: 'Sanskrit_HA' },
    { source: 'Bhagavad Gita', target: 'HA' },
    { source: 'Bhagavad Gita', target: 'Yggdrasil' },
    { source: 'Bhagavad Gita', target: 'Tree' },
    { source: 'Bhagavad Gita', target: 'DNA' },
    { source: 'Bhagavad Gita', target: 'Roots' },
    { source: 'Bhagavad Gita', target: 'Ouroboros' },
    { source: 'Bhagavad Gita', target: 'Asgard' },
    { source: 'Bhagavad Gita', target: 'Midgard' },
    { source: 'Bhagavad Gita', target: 'Hel' },
    { source: 'Bhagavad Gita', target: 'Norns' },
    { source: 'Bhagavad Gita', target: 'Urd' },
    { source: 'Bhagavad Gita', target: 'Verdandi' },
    { source: 'Bhagavad Gita', target: 'Skuld' },
    { source: 'Bhagavad Gita', target: 'Saraswati' },
    { source: 'Bhagavad Gita', target: 'Lakshmi' },
    { source: 'Bhagavad Gita', target: 'Parvati' },
    { source: 'Bhagavad Gita', target: 'HolyTrinity' },
    { source: 'Bhagavad Gita', target: 'Father' },
    { source: 'Bhagavad Gita', target: 'Son' },
    { source: 'Bhagavad Gita', target: 'HolySpirit' },

    //add edges for Hávamál node

    {
      source: 'Hávamál',
      target: 'Bhagavad Gita',
      type: 'info',
      info: 'Both are in verse form (versemaal), sharing cosmic wisdom through poetic language',
    },
    {
      source: 'Hávamál',
      target: 'Yggdrasil',
      type: 'info',
      info: 'Contains cosmological wisdom of the Norse world tree',
    },
    {
      source: 'Bhagavad Gita',
      target: 'Tree',
      type: 'info',
      info: 'Describes the cosmic ashvattha tree with roots above and branches below, like Yggdrasil',
    },
  ],
}

// Full sanitized JSON dataset (inlined)
const rawGraph = {
  nodes: [
    { id: 'Vegvísir', label: 'Vegvísir', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Compass', label: 'Compass', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Trigrams', label: 'Trigrams', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Guidance', label: 'Guidance', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'HA', label: 'HA', group: 'Phonetic', color: 'gold' },
    { id: 'Breath', label: 'Breath', group: 'Phonetic', color: 'gold' },
    { id: 'Sanskrit', label: 'Sanskrit', group: 'Phonetic', color: 'gold' },
    { id: 'Hebrew', label: 'Hebrew', group: 'Phonetic', color: 'gold' },
    { id: 'Seed', label: 'Seed', group: 'Phonetic', color: 'gold' },
    { id: 'Mantra', label: 'Mantra', group: 'Phonetic', color: 'gold' },
    { id: 'Sound', label: 'Sound', group: 'Phonetic', color: 'gold' },
    { id: 'Syllables', label: 'Syllables', group: 'Phonetic', color: 'gold' },
    {
      id: 'Yggdrasil',
      label: 'Yggdrasil',
      group: 'Mythic Symbols',
      color: 'lightgreen',
      hasSubgraph: true,
    },
    { id: 'Tree', label: 'Tree', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'DNA', label: 'DNA', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'Ouroboros', label: 'Ouroboros', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'Runes', label: 'Runes', group: 'Runes', color: 'lightskyblue' },
    { id: 'Elder Futhark', label: 'Elder Futhark', group: 'Runes', color: 'lightskyblue' },
    { id: 'Ættir', label: 'Ættir', group: 'Runes', color: 'lightskyblue' },
    { id: 'Phonetic', label: 'Phonetic', group: 'Phonetic', color: 'gold' },
    { id: '54 Letters', label: '54 Letters', group: 'Phonetic', color: 'gold' },
    { id: 'Bagua', label: 'Bagua', group: 'Esoteric Systems', color: 'violet' },
    { id: 'Pre-Heaven', label: 'Pre-Heaven', group: 'Esoteric Systems', color: 'violet' },
    { id: 'Post-Heaven', label: 'Post-Heaven', group: 'Esoteric Systems', color: 'violet' },
    { id: 'AZ', label: 'AZ', group: 'Centering', color: 'mediumorchid' },
    { id: 'Center', label: 'Center', group: 'Centering', color: 'mediumorchid' },
    { id: 'Unity', label: 'Unity', group: 'Centering', color: 'mediumorchid' },
    { id: 'Non-duality', label: 'Non-duality', group: 'Centering', color: 'mediumorchid' },
    { id: 'Hanuman', label: 'Hanuman', group: 'Mythology', color: 'tan' },
    { id: 'Mythology', label: 'Mythology', group: 'Mythology', color: 'tan' },
    { id: 'Hávamál', label: 'Hávamál', group: 'Mythology', color: 'tan' },
    { id: 'Elements', label: 'Elements', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Fire', label: 'Fire', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Water', label: 'Water', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Earth', label: 'Earth', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Air', label: 'Air', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Ether', label: 'Ether', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Midjourney', label: 'Midjourney', group: 'Tools', color: 'gray' },
    { id: 'Infographic', label: 'Infographic', group: 'Tools', color: 'gray' },
    { id: 'Illustrator', label: 'Illustrator', group: 'Tools', color: 'gray' },
  ],
  edges: [
    { source: 'Vegvísir', target: 'Compass', weight: 9 },
    { source: 'Vegvísir', target: 'Trigrams', weight: 8 },
    { source: 'Vegvísir', target: 'Guidance', weight: 7 },
    { source: 'Trigrams', target: 'Bagua', weight: 9 },
    { source: 'HA', target: 'Breath', weight: 2 },
    { source: 'HA', target: 'Sanskrit', weight: 8 },
    { source: 'HA', target: 'Hebrew', weight: 8 },
    { source: 'HA', target: 'Seed', weight: 7 },
    { source: 'Breath', target: 'Mantra', weight: 8 },
    { source: 'Sanskrit', target: 'Phonetic', weight: 8 },
    { source: 'Sanskrit', target: '54 Letters', weight: 7 },
    { source: 'Seed', target: 'Mantra', weight: 7 },
    { source: 'Mantra', target: 'Sound', weight: 9 },
    { source: 'Sound', target: 'Syllables', weight: 8 },
    { source: 'Yggdrasil', target: 'Tree', weight: 9 },
    { source: 'Yggdrasil', target: 'DNA', weight: 7 },
    { source: 'Yggdrasil', target: 'Ouroboros', weight: 7 },
    { source: 'Runes', target: 'Elder Futhark', weight: 9 },
    { source: 'Elder Futhark', target: 'Ættir', weight: 8 },
    { source: 'Bagua', target: 'Pre-Heaven', weight: 8 },
    { source: 'Bagua', target: 'Post-Heaven', weight: 8 },
    { source: 'AZ', target: 'Center', weight: 9 },
    { source: 'AZ', target: 'Unity', weight: 8 },
    { source: 'Unity', target: 'Non-duality', weight: 9 },
    { source: 'Hanuman', target: 'Mythology', weight: 8 },
    { source: 'Mythology', target: 'Hávamál', weight: 7 },
    { source: 'Elements', target: 'Fire', weight: 6 },
    { source: 'Elements', target: 'Water', weight: 6 },
    { source: 'Elements', target: 'Earth', weight: 6 },
    { source: 'Elements', target: 'Air', weight: 6 },
    { source: 'Elements', target: 'Ether', weight: 6 },
    { source: 'Midjourney', target: 'Infographic', weight: 7 },
    { source: 'Infographic', target: 'Illustrator', weight: 9 },
  ],
}

const nodeIds = new Set(rawGraph.nodes.map((n) => n.id))
const degreeMap = {}
rawGraph.nodes.forEach((n) => (degreeMap[n.id] = 0))
rawGraph.edges.forEach((e) => {
  if (degreeMap[e.source] !== undefined) degreeMap[e.source]++
  if (degreeMap[e.target] !== undefined) degreeMap[e.target]++
})

const mainElements = [
  ...rawGraph.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      color: n.color,
      group: n.group,
      hasSubgraph: !!n.hasSubgraph,
      size: degreeMap[n.id] || 1,
    },
  })),
  ...rawGraph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      data: {
        id: `${e.source}_${e.target}`,
        source: e.source,
        target: e.target,
        weight: e.weight,
      },
    })),
]

const getFilteredElements = () => {
  if (!infoOnly.value) return mainElements
  return mainElements.filter((el) => {
    if (el.data.type === 'infonode' || el.data.info) return true
    if (el.data.source && el.data.target) {
      const sourceNode = mainElements.find((n) => n.data.id === el.data.source)
      const targetNode = mainElements.find((n) => n.data.id === el.data.target)
      return (
        (sourceNode && sourceNode.data.type === 'infonode') ||
        (targetNode && targetNode.data.type === 'infonode') ||
        el.data.info
      )
    }
    return false
  })
}

const getFilteredSubgraphElements = (subDegreeMap) => {
  const subNodes = yggdrasilSubgraph.nodes
    .filter((n) => !infoOnly.value || n.type === 'infonode' || n.info)
    .map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        color: n.color,
        size: subDegreeMap[n.id] || 1,
        type: n.type || null,
        info: n.info || null,
      },
      classes: 'subgraph',
    }))

  const visibleNodeIds = new Set(subNodes.map((n) => n.data.id))

  const subEdges = yggdrasilSubgraph.edges
    .filter((e) => {
      const edgeHasInfo = e.type === 'info' || e.info
      const nodesAreVisible = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      return !infoOnly.value || edgeHasInfo || nodesAreVisible
    })
    .map((e) => ({
      data: {
        id: `${e.source}_${e.target}`,
        source: e.source,
        target: e.target,
        type: e.type || null,
        info: e.info || null,
      },
      classes: 'subgraph',
    }))

  return [...subNodes, ...subEdges]
}

const toggleInfoOnly = async () => {
  infoOnly.value = !infoOnly.value
  cyInstance.elements().remove()
  if (isSubgraphActive.value && currentSubDegreeMap.value) {
    cyInstance.add(getFilteredSubgraphElements(currentSubDegreeMap.value))
    await nextTick()
    setTimeout(() => {
      // <-- Add short delay to ensure Cytoscape readiness
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 200,
          nodeRepulsion: 5000,
        })
        .run()
    }, 50)
  } else {
    cyInstance.add(getFilteredElements())
    await nextTick()
    setTimeout(() => {
      // <-- Add short delay here as well
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 150,
          nodeRepulsion: 4000,
        })
        .run()
    }, 50)
  }
  selectedElement.value = null
}

function loadMainGraph() {
  if (!cyInstance) return
  cyInstance.elements().remove()
  cyInstance.add(mainElements)
  cyInstance.layout({ name: 'cose' }).run()
  selectedElement.value = null
}

onMounted(() => {
  cyInstance = cytoscape({
    container: document.getElementById('cy'),
    elements: getFilteredElements(),
    layout: {
      name: 'cose',
      idealEdgeLength: 150, // <-- Increase to spread nodes out
      nodeRepulsion: 4000, // <-- Add repulsion to avoid clustering
    },
    style: [
      {
        selector: 'node',
        style: {
          label: (ele) =>
            ele.data('type') === 'infonode' ? ele.data('label') + ' ℹ️' : ele.data('label'),
          'background-color': 'data(color)',
          color: '#222',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          width: 'mapData(size, 1, 10, 20, 80)',
          height: 'mapData(size, 1, 10, 20, 80)',
          'border-width': 0.5,
          'border-color': '#000',
          'border-style': 'solid',
        },
      },
      {
        selector: 'node[id = "Yggdrasil"]',
        style: {
          'border-width': 0.5,
          'border-color': '#000',
          'border-style': 'dashed',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1, // <-- Ensure edge width is always 1pt
          'line-color': '#999',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#ccc',
          'curve-style': 'bezier',
          label: (ele) => (ele.data('info') ? 'ℹ️' : ''),
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': '-10px',
          color: '#555',
        },
      },
      {
        selector: 'node.subgraph',
        style: {
          shape: 'ellipse', // circular form
          width: 'mapData(size, 1, 5, 20, 60)', // weighted size
          height: 'mapData(size, 1, 5, 20, 60)', // weighted size
          'border-width': 1,
          'border-color': '#000',
          'border-style': 'solid',
          'background-color': 'data(color)',
          label: (ele) =>
            ele.data('type') === 'infonode' ? ele.data('label') + ' ℹ️' : ele.data('label'),
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          color: '#222',
        },
      },
      {
        selector: 'edge.subgraph',
        style: {
          width: 1, // Explicitly set edge width to 1pt
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#ccc',
          'arrow-scale': 0.5,
          'line-color': '#999',
          'curve-style': 'bezier',
          label: (ele) => (ele.data('info') ? 'ℹ️' : ''),
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          color: '#555',
        },
      },
    ],
  })

  cyInstance.on('tap', 'node, edge', (event) => {
    const element = event.target
    const data = element.data()

    selectedElement.value = {
      label: data.label || `${data.source} → ${data.target}`,
      info: data.info || null,
      type: data.type || null,
    }

    if (element.isNode() && data.hasSubgraph && data.id === 'Yggdrasil') {
      isSubgraphActive.value = true
      cyInstance.elements().remove()

      const subDegreeMap = {}
      yggdrasilSubgraph.nodes.forEach((n) => (subDegreeMap[n.id] = 0))
      yggdrasilSubgraph.edges.forEach((e) => {
        subDegreeMap[e.source]++
        subDegreeMap[e.target]++
      })

      currentSubDegreeMap.value = subDegreeMap // <-- Store subDegreeMap here

      cyInstance.add(getFilteredSubgraphElements(subDegreeMap))
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 200, // <-- Spread out subgraph nodes
          nodeRepulsion: 5000, // <-- Add repulsion for subgraph
        })
        .run()
    }
  })
})
</script>
