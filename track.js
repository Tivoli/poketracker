const readline = require('readline');
const {Pokeio} = require('pokemon-go-node-api');
const pgo = new Pokeio();
const baseStats = require('./baseStats');

let location, provider, username, password, pokemon;

function convertIV(id, stam, atk, def, multiplier) {
  const {BaseStamina, BaseAttack, BaseDefense} = baseStats.find((b) => b.id === id);
  const stamina = (BaseStamina + (stam || 0)) * multiplier;
  const attack = (BaseAttack + (atk || 0)) * multiplier;
  const defense = (BaseDefense + (def || 0)) * multiplier;
  return Math.floor(Math.pow(stamina, 0.5) * attack * Math.pow(defense, 0.5) / 10);
}

function calculateCP(mon) {
  const multiplier = mon.cp_multiplier + (mon.addition_cp_multiplier || 0);
  return {
    minCP: convertIV(mon.pokemon_id, 0, 0, 0, multiplier),
    currCP: convertIV(mon.pokemon_id, mon.individual_stamina, mon.individual_attack, mon.individual_defense, multiplier),
    maxCP: convertIV(mon.pokemon_id, 15, 15, 15, multiplier),
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'Tracker> ',
});

rl.on('close', () => {
  console.info('Tracker closed');
  process.exit(0);
});

function askLocation() {
  return new Promise((resolve) => {
    rl.question('What is your location? ', (answer) => {
      location = {
        type: 'name',
        name: answer,
      }
      resolve(answer);
    })
  });
}

function askProvider() {
  return new Promise((resolve) => {
    rl.question('How do you log in to pokemon go (google|ptc)? ', (answer) => { provider = answer; resolve(answer); })
  });
}

function askUsername() {
  return new Promise((resolve) => {
    rl.question('What is your pokemon go username? ', (answer) => { username = answer; resolve(answer); })
  });
}

function askPassword() {
  return new Promise((resolve) => {
    rl.question('What is your pokemon go password? ', (answer) => { password = answer; resolve(answer); })
  });
}

function pgoInit() {
  return new Promise((resolve, reject) => {
    pgo.init(username, password, location, provider, function(err) {
      err ? reject(err) : resolve(pgo);
    });
  });
}

function fetchPokemon() {
  return new Promise((resolve, reject) => {
    pgo.GetInventory((err, res) => {
      if (err) reject(err);
      if (res.inventory_delta && res.inventory_delta.inventory_items) {
        const filtered = res.inventory_delta.inventory_items.filter((item) => {
          return item.inventory_item_data.pokemon && item.inventory_item_data.pokemon.pokemon_id;
        });
        resolve(filtered.map((item) => { return item.inventory_item_data.pokemon; }));
      }
    });
  });
}

askLocation()
  .then(askProvider)
  .then(askUsername)
  .then(askPassword)
  .then(pgoInit)
  .then(fetchPokemon)
  .then((pokemon) => {
    console.info(`You have ${pokemon.length} pokemon!`);
    console.info(`.exit or .close will close the application`);
    console.info(`Enter a pokemon name to find it's stats`);
    rl.prompt();
    rl.on('line', (line) => {
      if (/^\.(exit|close)/.test(line)) return rl.close();
      pokemon.forEach((mon) => {
        const info = pgo.pokemonlist.find((p) => { return parseInt(p.id) === mon.pokemon_id; });
        const regex = new RegExp(`^${line}`, 'gi');
        if (regex.test(info.name)) {
          const {minCP, currCP, maxCP} = calculateCP(mon);
          const percent = Math.floor(((currCP - minCP) / (maxCP - minCP)) * 100);
          console.info(`\n${info.name} ${mon.cp} (${percent}% possible CP)`)
          console.info(`    Stam: ${mon.individual_stamina}`, `Atk: ${mon.individual_attack}`, `Def: ${mon.individual_defense}`);
        }
      });
      rl.prompt();
    });
  })
  .catch((err) => {
    console.error(err);
    rl.close();
  });
