// Twelfth Night, or What You Will
// A short sample story showing off some ink basics.

VAR player_name = "Viola"
VAR disguise = "none"
VAR coins = 3
VAR olivia_charmed = false
VAR times_at_court = 0

CONST DUKE = "Orsino"

-> shore

=== shore ===
ILLYRIA. A wild shore, after the storm.
~ coins = coins - 1
I gave the captain my last coin but two and asked him what country this was.
"This is Illyria, lady."
"And what should I do in Illyria? My brother he is in Elysium." // A little grief, then on with it.

+ [Ask about the Duke] -> ask_about_duke
+ [Ask about the Countess Olivia] -> ask_about_olivia

= ask_about_duke
"There is a fair behaviour in thee, captain. Who governs here?"
"A noble duke, {DUKE}, in nature as in name. He seeks the love of fair Olivia."
-> decide_disguise

= ask_about_olivia
"And Olivia?"
"A virtuous maid, the daughter of a count. She hath abjured the company and sight of men."
-> decide_disguise

= decide_disguise
I made up my mind.
* [Disguise myself as a page boy, "Cesario"]
    ~ disguise = "Cesario"
    "Conceal me what I am. I'll serve this duke; thou shalt present me as a eunuch to him."
* [Go as myself]
    ~ disguise = "none"
    I would go to {DUKE} as I was, salt-stained and honest.
- -> court

=== court ===
~ times_at_court = times_at_court + 1
{times_at_court == 1: The Duke's palace. Music plays, somewhat mournfully.|The Duke's palace again. The same song, {~a little slower|louder now|as if it had never stopped}.}
{ disguise == "Cesario":
    "{DUKE} knows me but as Cesario, and yet he tells me everything."
- else:
    The Duke's men eyed my wet dress with suspicion.
}
"If music be the food of love, play on," sighed {DUKE}. Then he saw me.
"{disguise == "Cesario":Cesario|Good {player_name}}! Go to Olivia once more. Be not denied access. Stand at her doors and tell her my woes."

+ [Agree to go] -> olivia_house
+ [Refuse]
    "My lord, if she be so abandoned to her sorrow as it is spoke, she never will admit me."
    "Be clamorous and leap all civil bounds rather than make unprofited return."
    -> court
* {coins > 0} [Offer him a coin for his trouble]
    ~ coins = coins - 1
    He laughed and would not take it. <>
    I had {coins} coin{coins != 1:s} left.
    -> court

=== olivia_house ===
OLIVIA'S HOUSE. The lady sat behind a veil.
"Good madam, let me see your face."
* [Speak the Duke's words]
    "Most radiant, exquisite and unmatchable beauty..." I began, and stopped. "I pray you, tell me if this be the lady of the house, for I never saw her."
    -> olivia_reacts
* [Speak my own]
    ~ olivia_charmed = true
    "If I did love you in my master's flame, with such a suffering, such a deadly life, in your denial I would find no sense."
    "Why, what would you?"
    "Make me a willow cabin at your gate, and call upon my soul within the house."
    -> olivia_reacts

= olivia_reacts
{ olivia_charmed:
    She lifted her veil. "You might do much," she said, and I saw with some alarm that she meant me, not the Duke.
- else:
    "Whence came you, sir?"
    "I can say little more than I have studied, and that question's out of my part."
    She dismissed me, but not unkindly.
}
-> finale

=== finale ===
{ olivia_charmed and disguise == "Cesario":
    O time, thou must untangle this, not I. It is too hard a knot for me to untie.
- else:
    I went back to the Duke with nothing but the same sad song to keep me company.
}
{ times_at_court > 1: I had walked that road {times_at_court} times now. }
Left in my purse: {coins} coin{coins != 1:s}.

-> END
