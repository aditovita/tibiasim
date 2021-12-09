var averageDamage = [];
var totalXP = 0;
var totalLoot = 0;
var totalBoxes = 0;
var elementalHPDamage = 0.05;
var totalSimulationsTurns = 0;
var lowProcs = 0;
var minDanageModifier = 0.75;
var maxDanageModifier = 1.25;
var onslaughtChance = 0;
var criticalMultiplier = 0;
var currentBox = [];
var charms = {};

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

function getArmorReduction(armor) {
  return getRandomIntInclusive(Math.floor(armor/2), (Math.floor(armor/2)*2 - 1));
}

function arrayRotate(arr, reverse) {
  if (reverse) arr.unshift(arr.pop());
  else arr.push(arr.shift());
  return arr;
}

function getRandomDamage(damage)
{
    return getRandomIntInclusive(damage * minDanageModifier, damage * maxDanageModifier);
}


function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function applyDamage(box, damageObj)
{
    var totalDamage = 0;
    var damage = getRandomDamage(damageObj.hit);
    if (damage == 0)
        return totalDamage;
    var lowBlowDamage = damage;
    var criticalDamage = 0;
    var onslaughtDamage = 0;
    // checking lesser than 8 because it starts at 0
    if (getRandomIntInclusive(0, 100) < 8)
    {
        lowBlowDamage = lowBlowDamage * 1.5;
    }
    if (getRandomIntInclusive(0, 100) < 10)
    {
        criticalDamage = damage * (criticalMultiplier - 1);
        if(criticalDamage < 0)
        {
            criticalDamage = 0;
        }
    }
    if (getRandomIntInclusive(0, 10000)/100 < onslaughtChance)
    {
        onslaughtDamage = damage * .6;
    }
    damage += criticalDamage + onslaughtDamage;
    box = shuffle(box);
    var hits = 0;
    for (var i = 0; i < box.length; i++) {
        if (box[i].hp <= 0 || hits > damageObj.aoe)
            continue;
        hits++;
        // avoiding counting overkill damage
        var currentDamage = damage;
        if (charms[box[i].name] !== undefined)
        {
            if (charms[box[i].name] == 'low-blow')
            {
                currentDamage = currentDamage < lowBlowDamage ? lowBlowDamage : currentDamage;
            } else if (charms[box[i].name] != 'dodge' && getRandomIntInclusive(0, 100) < 10)
            {
                currentDamage += Math.floor(box[i].original_hp * elementalHPDamage * (box[i][charms[box[i].name]] / 100));
            }
        }
        currentDamage = currentDamage * (box[i][damageObj.element] / 100);
        if( damageObj.element == 'physical' )
        {
            currentDamage -= getArmorReduction(box[i].armor);
        }
        if (box[i].hp <= currentDamage)
        {
            totalDamage += box[i].hp;
            totalXP += box[i].exp;
            totalLoot += box[i].loot_value;
        } else
        {
            totalDamage += currentDamage;
        }
        box[i].hp -= currentDamage;
    }
    return totalDamage;
}

function getNewBox()
{
    totalBoxes++;
    var monsters = [];
    for (var i = 0; i < currentBox.length; i++) {
        monsterCopy = JSON.parse(JSON.stringify(currentBox[i]));
        monsterCopy.original_hp = monsterCopy.hp;
        monsters.push(monsterCopy);
    }
    return monsters;
}

function clearedBox(box)
{
    for (var i = 0; i < box.length; i++) {
        if (box[i].hp > 0)
            return false;
    }
    return true;
}

function getHits(box)
{
    var totalHits = 0;
    for (var i = 0; i < box.length; i++) {
        if (box[i].hp > 0) {
            if (charms[box[i].name] == 'dodge' && getRandomIntInclusive(0, 100) < 10)
                continue;
            totalHits++;
        }
    }
    return totalHits;
}

function countAliveMobs(box)
{
    var totalMobs = 0;
    for (var i = 0; i < box.length; i++) {
        if (box[i].hp > 0) {
            totalMobs++;
        }
    }
    return totalMobs;
}

// only after finishing a box we refresh the box
function simulation()
{
    StorageEngine.store('currentBox', currentBox);
    StorageEngine.store('currentBoxHTML', $('#current-box').html());
    totalBoxes = 0;
    totalXP = 0;
    totalLoot = 0;
    charms = {};
    $('.runes select').each(function () {
        charms[$(this).find('option:selected').val()] = $(this).data('element');
    });
    averageDamage = {
            'auto': { 'hit': $('#average-damage-1').val(), 'aoe': $('#damage-1-avg-mob-turn').val(), 'element': $('#damage-1-element').val() },
            'spell': []
    };
	var i = 1;
    while ($('#average-spell-' + i).length) {
        if( $('#average-spell-' + i).val() > 0 )
        {
            averageDamage.spell.push({ 'hit': $('#average-spell-' + i).val(), 'aoe': $('#spell-' + i + '-avg-mob-turn').val(), 'element': $('#spell-' + i + '-element').val() });
        }
		i++;
    }
    totalSimulationsTurns = parseInt($('#total-turns').val());
    onslaughtChance = parseFloat($('#onslaught-chance').val());
    criticalMultiplier = parseFloat($('#critical-multiplier').val());
    var box = getNewBox();
    var totalDamageNoCharm = 0;
    var avoidedHitsNoCharm = 0;
    var maxHitsNoCharm = 0;
    for (var i = 0; i < totalSimulationsTurns; i++) {
        if (clearedBox(box))
        {
            box = getNewBox();
        }
        // lets check how many hits we are avoiding from the current pull
        maxHitsNoCharm += box.length;
        avoidedHitsNoCharm += box.length - getHits(box);
        // calc the damage
        totalDamageNoCharm += applyDamage(box, averageDamage.auto);
        totalDamageNoCharm += applyDamage(box, averageDamage.spell[0]);
        averageDamage.spell = arrayRotate(averageDamage.spell);
    }

    $('#results').html('');
    // The results
    $('#results').append('Total Damage: ' + totalDamageNoCharm.toLocaleString());
    //$('#results').append('<br>ElementalDamage/no charm: ' + (totalDamageElementalCharm/totalDamageNoCharm));
    //$('#results').append('<br>Low Blow Damage/no charm: ' + (totalDamageLowBlow/totalDamageNoCharm));
    $('#results').append('<br>Avoided Hits: ' + (avoidedHitsNoCharm / maxHitsNoCharm));
    var totalHours = ((totalSimulationsTurns * 2 + (totalBoxes * $('#box-seconds').val())) / 3600);
    $('#results').append('<br>XP/Hour: ' + (totalXP / totalHours).toLocaleString());
    $('#results').append('<br>Loot/Hour: ' + (totalLoot / totalHours).toLocaleString());
    //$('#results').append('<br>Avoided Hits: Low Blow ' + (avoidedHitsLowBlow/maxHitsLowBlow));
    //$('#results').append('<br>Avoided Hits: Elemental ' + (avoidedHitsElemental/maxHitsElemental));
}

var StorageEngine = {
    get: function ($name)
    {
        return JSON.parse(localStorage.getItem($name));
    },
    store: function ($name, $value)
    {
        localStorage.setItem($name, JSON.stringify($value));
    }
}

var MonsterDB = {
    monsters: new Array(),
    load: function ()
    {
        for (var x in monsters)
        {
            if (!monsters[x].image)
            {
                monsters[x].image = '14px-Cross3.jpg';
            }
            monsters[x].image = 'data/monster_images/' + monsters[x].image;
            this.monsters[monsters[x].name] = monsters[x];
        }
    },
    get: function (name) {
        return this.monsters[name];
    },
}

var ImageDB = {
    get: function (name)
    {
        var monster = MonsterDB.get(name);
        if (typeof monster != 'undefined')
        {
            return monster.image;
        } else if (name.startsWith('Icon-'))
        {
            return $('.pallete-icon[data-name="' + name + '"]').find('img').attr('src');
        }
        return false;
    }
}

var MapPallete = {
    selected: false,
    pallete: new Array()
}

$(document).ready(function () {
    MonsterDB.load();
    currentBox = StorageEngine.get('currentBox', currentBox);
    if( !currentBox )
    {
        currentBox = [];
    }
    $('#current-box').html(StorageEngine.get('currentBoxHTML'));

    for (var x in MonsterDB.monsters)
    {
        $('#monster-list')
                .append($("<option></option>")
                        .attr("value", MonsterDB.monsters[x].name)
                        .text(MonsterDB.monsters[x].name));
    }

    $(".chosen-select").chosen({disable_search_threshold: 10});
    $('.update-pallete').on('click', function (event) {
        event.preventDefault();
        $('.pallete').html('');
        $('.runes select').html('');
        $('.runes select').append($("<option value=\"none\">None</option>"));
        MapPallete.pallete = new Array();
        $("#monster-list option:selected").each(function () {
            var optionVal = $(this).val();
            var monster = MonsterDB.get(optionVal);
            if (typeof monster != 'undefined')
            {
                MapPallete.pallete.push(monster);
                $('.pallete').append($("<button class=\"pallete-item\" data-name=\"" + monster.name + "\"><img src=\"" + monster.image + "\"></button>"));
                $('.runes select').append($("<option value=\"" + monster.name + "\">" + monster.name + "</option>"));
            }
        });
        $('.pallete-item').on('click', function (event) {
            MapPallete.selected = MonsterDB.get($(this).attr('data-name'));
            $('.pallete-selected').html('');
            $('.pallete-selected').attr('data-name', $(this).attr('data-name'));
            $('.pallete-selected').attr('data-image', $(this).find('img').attr('src'));
            $(this).find('img').clone().appendTo(".pallete-selected");
        });
    });
    $('.clear-box').on('click', function (event) {
        currentBox = [];
        $('#current-box').html('');
    });
    $('.pallete-icon').on('click', function (event) {
        MapPallete.selected = {name: $(this).attr('data-name'), image: $(this).find('img').attr('src')};
        $('.pallete-selected').html($(this).attr('data-name'));
        $('.pallete-selected').attr('data-name', $(this).attr('data-name'));
        $('.pallete-selected').attr('data-image', $(this).find('img').attr('src'));
        $(this).find('img').clone().appendTo(".pallete-selected");
    });
    $('.pallete-add-to-box').on('click', function (event) {
        if (MapPallete.selected)
        {
            currentBox.push(JSON.parse(JSON.stringify(MapPallete.selected)));
            $('#current-box').append('<button onclick="showInfo(this)"><img src="' + MapPallete.selected.image + '" data-name="' + MapPallete.selected.name + '" /></button>');
        }
    });
	$('#adjust-level').on('click', function(){
		$('#average-damage-1').val( parseInt($('#average-damage-1').val()) + parseInt($( '#level-modifier' ).val()/5)  );
		var i = 1;
		while( $('#average-spell-' + i).length ) {
			if( $('#average-spell-' + i).val() > 0 )
				$('#average-spell-' + i).val( parseInt($('#average-spell-' + i).val()) + parseInt($( '#level-modifier' ).val()/5)  );
			i++;
		}
		simulation();
	});

});

function removeBoxItem(name)
{
    for( var i = 0; i < currentBox.length; i++ )
    {
        if(currentBox[i].name == name)
        {
            currentBox.splice(i, 1);
            break;
        }
    }
    $('#current-box').find('[data-name="'+ name +  '"]').eq(0).parent().remove();
}

function showInfo(object)
{
    var currentMonster = MonsterDB.get($(object).find('img').data('name'));
    var contentString = "";
    if (typeof currentMonster != 'undefined')
    {
        contentString += currentMonster.name;
        contentString += "<div>HP: " + currentMonster.hp + "</div>";
        contentString += "<div>XP: " + currentMonster.exp + "</div>";
        contentString += "<div>Speed: " + currentMonster.speed + "</div>";
        contentString += "<div>Armor: " + currentMonster.armor + "</div>";
        contentString += "<div>Death: " + currentMonster.death + "</div>";
        contentString += "<div>Earth: " + currentMonster.earth + "</div>";
        contentString += "<div>Energy: " + currentMonster.energy + "</div>";
        contentString += "<div>Fire: " + currentMonster.fire + "</div>";
        contentString += "<div>Holy: " + currentMonster.holy + "</div>";
        contentString += "<div>Ice: " + currentMonster.ice + "</div>";
        contentString += "<div>Physical: " + currentMonster.physical + "</div>";
        contentString += "<div>Average Loot: " + currentMonster.loot_value + "</div>";
        contentString += "<div><button onclick='removeBoxItem(\"" +  currentMonster.name + "\")'>Remove</button></div>";
    }

    $('#map-modal .modal-body').html(contentString);
    $('#map-modal').modal('show');
}

$('#simulate').on('click', function () {
    simulation();
});
