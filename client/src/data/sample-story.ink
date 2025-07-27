VAR player_name = "Passepartout"
VAR days_remaining = 80
VAR has_passport = true
VAR countries_visited = 0

LONDON, 1872
Residence of Monsieur Phileas Fogg.
~ countries_visited = countries_visited + 1
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
~ days_remaining = days_remaining - 1

+ "But of course"
    -> ending


=== nod ===
I nodded curtly, not believing a word of it.
~ has_passport = false
-> ending


=== ending ===
"We shall circumnavigate the globe within {days_remaining} days." He was quite calm as he proposed this wild scheme. "We leave for Paris on the 8:25. In an hour."
~ countries_visited = countries_visited + 1
-> END
