LIST fruit = apple, pear
VAR count = 0

=== start ===
~ temp roll = RANDOM(1, 6)
~ temp turns = TURNS_SINCE(-> start)
~ temp seen = CHOICE_COUNT()
~ count = LIST_COUNT(fruit)
Roll {roll}; turns {turns}; choices {seen}; fruit {count}.
-> END
