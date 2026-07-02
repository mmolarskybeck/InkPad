=== function calculate_bonus(score, ref total) ===
~ total = total + score
~ return total

=== start ===
VAR total = 0
~ total = calculate_bonus(2, total)
-> END

