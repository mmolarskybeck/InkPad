// Twelfth Night, or What You Will
// A short sample story showing off some ink basics.

VAR player_name = "Viola"
VAR disguise = "none"
VAR coins = 3
VAR olivia_charmed = false
VAR heard_of_olivia_first = false
VAR refusals = 0
VAR times_at_court = 0

CONST DUKE = "Orsino"

-> shore

=== function my_name()
{ disguise == "Cesario":
    ~ return "Cesario"
- else:
    ~ return player_name
}

=== shore ===
ILLYRIA. A shore after the storm.
~ coins = coins - 1
I gave the captain a coin.
"Know'st thou this country?"
"Ay, madam, well, for I was bred and born not three hours' travel from this very place."
-> questions

= questions
* ["Who governs here?"] -> ask_about_duke
* ["Is there a goodly woman in this country who might take me in?"] -> ask_about_olivia
+ {shore.ask_about_duke or shore.ask_about_olivia} [Enough questions.] -> decide

= ask_about_duke
"Who governs here?"
"The Duke {DUKE}. He seeks the love of fair Olivia."
"{DUKE}. I have heard my father name him."
-> questions

= ask_about_olivia
~ heard_of_olivia_first = (shore.ask_about_duke == 0)
"Is there a goodly woman in this country who might take me in?"
"The Countess Olivia. But she hath abjured the sight and company of men."
"O that I served that lady."
"That were hard to compass, madam."
-> questions

= decide
* {heard_of_olivia_first} [Go to the Countess first, as I am] -> olivia_estate
* [Disguise myself as a page boy, "Cesario"]
    ~ disguise = "Cesario"
    "Conceal me what I am. I'll serve this duke; thou shalt present me as a eunuch to him."
* [Go to the Duke as myself]
    ~ disguise = "none"
    I would go to {DUKE} as I was, salt-stained and honest.
- -> court

=== olivia_estate ===
OLIVIA'S GATE. A steward barred the way.
"The lady sees no one. She hath abjured the sight and company of men."
"I am no man."
"Nor any one else, madam. Good day."
~ coins = coins - 1
-> shore.decide

=== court ===
~ times_at_court = times_at_court + 1
{ disguise == "none":
    -> refused_at_court
}
{times_at_court == 1: THE DUKE'S PALACE. Music plays.|THE DUKE'S PALACE. The same song, {~slower|louder|still playing}.}
"{DUKE} knows me only as Cesario."
"If music be the food of love, play on," said {DUKE}.
"{my_name()}! Go to Olivia. Be not denied access. Stand at her doors and tell her my woes."

+ [Agree to go] -> olivia_house
+ [Refuse]
    ~ refusals = refusals + 1
    "My lord, if she be so abandoned to her sorrow as it is spoke, she never will admit me."
    { refusals == 1:
        "Be clamorous and leap all civil bounds rather than make unprofited return."
        -> court
    - else:
        "Then thou art no friend to me, {my_name()}."
        -> beach_pensive
    }
* {coins > 0} [Offer him a coin for his trouble]
    ~ coins = coins - 1
    He laughed. "Keep thy coin." <>
    I had {coins} coin{coins != 1:s} left.
    -> court

=== refused_at_court ===
THE DUKE'S PALACE. Music sounded behind closed doors.
"My lord will admit no woman to his presence."
"None?"
"None but the fair Olivia."
-> beach_pensive

=== olivia_house ===
OLIVIA'S HOUSE. {olivia_estate: This time, the Duke's name opened the gate.|Olivia sat behind a veil.}
"Good madam, let me see your face."
* [Speak the Duke's words]
    "Most radiant, exquisite and unmatchable beauty... I pray you, tell me if this be the lady of the house, for I never saw her."
    -> olivia_reacts
* [Speak my own]
    ~ olivia_charmed = true
    "If I did love you in my master's flame, with such a suffering, such a deadly life, in your denial I would find no sense."
    "Why, what would you?"
    "Make me a willow cabin at your gate, and call upon my soul within the house."
    -> olivia_reacts

= olivia_reacts
{ olivia_charmed:
    She lifted her veil. "You might do much."
    She meant me, not the Duke.
- else:
    "Whence came you, sir?"
    "I can say little more than I have studied, and that question's out of my part."
    "Farewell."
}
-> finale

=== finale ===
{ olivia_charmed and disguise == "Cesario":
    O time, thou must untangle this, not I. It is too hard a knot for me to untie.
- else:
    The same sad song followed me back to the Duke.
}
{ times_at_court > 1: I had walked that road {times_at_court} times. }
Left in my purse: {coins} coin{coins != 1:s}.
-> END

=== beach_pensive ===
THE SHORE. The same tide.
{ disguise == "Cesario": "Cesario has lost his first post."|"So much for honest {player_name}." }
"What else may hap, to time I will commit."
Left in my purse: {coins} coin{coins != 1:s}.
-> END
