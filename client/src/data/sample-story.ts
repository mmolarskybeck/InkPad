export const SAMPLE_STORY = `LONDON, 1872
Residence of Monsieur Phileas Fogg.
-> london

=== london ===
Monsieur Phileas Fogg returned home early from the Reform Club, and in a new-fangled steam-carriage, besides!  
"Passepartout," said he. "We are going around the world!"

+ "Around the world, Monsieur?"
    I was utterly astonished. 
    -> astonished
+ [Nod curtly.] -> nod

=== astonished ===
"You are in jest!" I told him in dignified affront. "You make mock of me, Monsieur."
"I am quite serious."

+ "But of course"
    -> ending

=== nod ===
I nodded curtly, not believing a word of it.
-> ending

=== ending ===
"We shall circumnavigate the globe within eighty days." He was quite calm as he proposed this wild scheme. "We leave for Paris on the 8:25. In an hour."
-> END

=== look_around ===
~ current_knot = "look_around"
You scan your surroundings carefully.

{ health > 80:
    Your sharp eyes catch a glimmer between the trees.
    * [Investigate the glimmer] -> scene_one
- else:
    You feel dizzy and struggle to focus.
    * [Sit down and rest] -> rest
}

* [Head back] -> start

=== call_out ===
~ current_knot = "call_out"
"Hello? Is anyone there?" you shout into the darkness.

Your voice echoes through the trees, but there's no response. The silence feels oppressive.

~ health -= 5

* [Try again, louder] -> call_louder
* [Give up and explore quietly] -> look_around
* [Go back] -> start

=== call_louder ===
You take a deep breath and shout as loud as you can.

This time, you hear something rustling in the bushes nearby.

{ health > 50:
    * [Approach the sound cautiously] -> encounter_creature
- else:
    * [Back away slowly] -> retreat
}

* [Stand your ground] -> stand_ground

=== stay_still ===
~ current_knot = "stay_still"
You decide to remain perfectly still and listen.

In the quiet, you begin to hear the subtle sounds of the forest: distant owl hoots, rustling leaves, and... footsteps?

~ health += 10

* [Follow the footsteps] -> follow_steps
* [Hide behind a tree] -> hide
* [Investigate your surroundings] -> look_around

=== scene_one ===
~ current_knot = "scene_one"
As you approach, you realize it's an old lantern hanging from a branch. The metal is tarnished, but it still holds a faint glow.

* [Take the lantern] -> take_lantern
* [Leave it alone] -> leave_lantern
* [Examine it more closely] -> examine_lantern

=== take_lantern ===
You carefully lift the lantern from the branch. Its warm light illuminates the path ahead, revealing a narrow trail you hadn't noticed before.

~ health += 15

The lantern seems to pulse with a mysterious energy.

* [Follow the trail] -> forest_path
* [Go back the way you came] -> start

=== examine_lantern ===
Looking closer, you notice strange symbols etched into the metal. They seem to shift and change in the flickering light.

* [Touch the symbols] -> magic_discovery
* [Step back] -> scene_one

=== magic_discovery ===
The moment your finger touches the symbols, they flare with brilliant light. You feel a surge of power coursing through you.

~ health = 100
~ player_name = "The Chosen One"

You have awakened something ancient and powerful within yourself.

* [Embrace the power] -> good_ending
* [Fear the change] -> uncertain_ending

=== good_ending ===
~ current_knot = "good_ending"
With your newfound abilities, you feel confident and ready to face whatever challenges await you in this mysterious forest. 

Your journey is just beginning, but you know you have the strength to overcome any obstacle.

THE END

-> END

=== rest ===
You sit down on a fallen log and take some time to recover your strength.

~ health += 20

Feeling better, you notice details you missed before: carved marks on nearby trees, as if someone has been here recently.

* [Investigate the markings] -> find_clues
* [Continue resting] -> rest_more
* [Get up and explore] -> look_around

=== find_clues ===
The markings form a pattern pointing deeper into the forest. Someone or something wants travelers to follow this path.

* [Follow the markings] -> forest_path  
* [Go the opposite direction] -> avoid_path
* [Ignore them and explore freely] -> look_around

=== forest_path ===
~ current_knot = "forest_path"
Following the path, you come to a clearing where an old cabin sits beneath the moonlight.

* [Approach the cabin] -> cabin_encounter
* [Circle around it] -> circle_cabin
* [Go back] -> start

=== cabin_encounter ===
You walk up to the cabin door and notice it's slightly ajar. Warm light flickers from within.

* [Knock on the door] -> friendly_ending
* [Peek inside] -> mysterious_ending
* [Walk away] -> forest_path

=== friendly_ending ===
~ current_knot = "friendly_ending"
An elderly woman opens the door with a warm smile. "I've been expecting you," she says. "Come in, dear. You must be tired from your journey."

She offers you food, rest, and answers to your questions about this strange place.

THE END

-> END

=== mysterious_ending ===
~ current_knot = "mysterious_ending"  
Through the crack in the door, you see the cabin is much larger inside than it appeared from outside. Strange artifacts line the walls, and books float gently through the air.

You have discovered something beyond ordinary understanding.

THE END

-> END

=== uncertain_ending ===
~ current_knot = "uncertain_ending"
The power feels overwhelming and alien. You're not sure if this change is a gift or a curse, but there's no going back now.

Your future remains unwritten, full of possibilities both wonderful and terrifying.

THE END

-> END`;
