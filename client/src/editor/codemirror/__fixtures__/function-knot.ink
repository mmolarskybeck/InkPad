VAR total = 0

=== function calculate_bonus(score, ref running_total) ===
~ running_total = running_total + score
~ return running_total

=== start ===
~ total = calculate_bonus(2, total)
Total: {total}
-> END
