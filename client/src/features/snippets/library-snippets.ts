// inkle's own longer ink snippets, as shipped in Inky's snippet menu.
//
// The `.ink` files under ./library/ are verbatim copies from inkle's Inky
// repository (MIT licensed — see THIRD_PARTY_NOTICES.md). They are imported raw
// so the shipped text stays byte-identical to upstream, and every entry here is
// compile-verified in library-snippets.test.ts.

import type { InkSnippet } from "./ink-snippets";

import aOrAn from "./library/a_or_an.ink?raw";
import cameFrom from "./library/came_from.ink?raw";
import listItemIsMemberOf from "./library/list_item_is_member_of.ink?raw";
import listPop from "./library/list_pop.ink?raw";
import listPopRandom from "./library/list_pop_random.ink?raw";
import listPrevNext from "./library/list_prev_next.ink?raw";
import listRandomSubset from "./library/list_random_subset.ink?raw";
import listRandomSubsetOfSize from "./library/list_random_subset_of_size.ink?raw";
import listWithCommas from "./library/list_with_commas.ink?raw";
import listToNumber from "./library/listToNumber.ink?raw";
import maybe from "./library/maybe.ink?raw";
import printNumber from "./library/print_number.ink?raw";
import seenMoreRecentlyThan from "./library/seen_more_recently_than.ink?raw";
import seenThisScene from "./library/seen_this_scene.ink?raw";
import seenVeryRecently from "./library/seen_very_recently.ink?raw";
import stringToList from "./library/string_to_list.ink?raw";
import swingVariables from "./library/swing_variables.ink?raw";
import storylets from "./library/storylets.ink?raw";
import threadInTunnel from "./library/thread_in_tunnel.ink?raw";
import typeOf from "./library/type_of.ink?raw";
import uppercase from "./library/uppercase.ink?raw";

/**
 * Prepare raw file text for insertion. CodeMirror's `snippet()` reads `${` as a
 * tab stop and `#{` as a line marker, so both are escaped; library snippets have
 * no placeholders and must go in literally. The result always ends with exactly
 * one newline so the block lands as a block.
 */
export function toLibrarySnippetText(fileContent: string): string {
  return `${fileContent
    .replace(/\$\{/g, "\\${")
    .replace(/#\{/g, "\\#{")
    .replace(/\n+$/, "")}\n`;
}

/** Two short maths helpers that live inline in Inky's menu, not in a file. */
const DIVISOR_INK = "=== function divisor(x, n)\n~ return (x - x mod n) / n\n";

const ABS_INK =
  "=== function abs(x)\n" +
  "{ x < 0:\n" +
  "      ~ return -1 * x\n" +
  "  - else: \n" +
  "      ~ return x\n" +
  "}\n";

interface LibraryEntry {
  id: string;
  label: string;
  aliases: string[];
  description: string;
  /** Raw ink text, straight from the library file (or from Inky's menu). */
  file: string;
}

/** Ordered as Inky orders them: list handling, useful functions, systems. */
const ENTRIES: LibraryEntry[] = [
  {
    id: "lib-list-pop",
    label: "List: pop",
    aliases: ["pop"],
    description:
      "Takes the bottom element from a list, and returns it, modifying the list.",
    file: listPop,
  },
  {
    id: "lib-list-pop-random",
    label: "List: pop_random",
    aliases: ["pop_random"],
    description:
      "Takes a random element from a list, and returns it, modifying the list.",
    file: listPopRandom,
  },
  {
    id: "lib-list-prev-next",
    label: "List: LIST_NEXT and LIST_PREV",
    aliases: ["LIST_NEXT", "LIST_PREV"],
    description:
      "Finds the next or previous value in a list, which may not be the current value plus or minus one.",
    file: listPrevNext,
  },
  {
    id: "lib-list-item-is-member-of",
    label: "List: list_item_is_member_of",
    aliases: ["list_item_is_member_of"],
    description: "Does a list item originate from a particular list?",
    file: listItemIsMemberOf,
  },
  {
    id: "lib-list-random-subset",
    label: "List: list_random_subset",
    aliases: ["list_random_subset"],
    description: "Returns a randomised subset of items from a list.",
    file: listRandomSubset,
  },
  {
    id: "lib-list-random-subset-of-size",
    label: "List: list_random_subset_of_size",
    aliases: ["list_random_subset_of_size"],
    description:
      "Returns a randomised subset of items from a list, up to a given size.",
    file: listRandomSubsetOfSize,
  },
  {
    id: "lib-string-to-list",
    label: "List: string_to_list",
    aliases: ["string_to_list"],
    description:
      "Converts a string to the corresponding list element from a particular list.",
    file: stringToList,
  },
  {
    id: "lib-maybe",
    label: "Logic: maybe",
    aliases: ["maybe"],
    description: "Quick random function for varying choices.",
    file: maybe,
  },
  {
    id: "lib-type-of",
    label: "Variables: type_of",
    aliases: ["type_of"],
    description: "Determines the type of a generic ink variable.",
    file: typeOf,
  },
  {
    id: "lib-divisor",
    label: "Math: divisor",
    aliases: ["divisor"],
    description: "Divides x by n and rounds the result down to a whole number.",
    file: DIVISOR_INK,
  },
  {
    id: "lib-abs",
    label: "Math: abs",
    aliases: ["abs"],
    description: "Returns the absolute (positive) value of a number.",
    file: ABS_INK,
  },
  {
    id: "lib-came-from",
    label: "Flow: came_from",
    aliases: ["came_from"],
    description: "Tests if the flow passes a particular gather on this turn.",
    file: cameFrom,
  },
  {
    id: "lib-seen-very-recently",
    label: "Flow: seen_very_recently",
    aliases: ["seen_very_recently"],
    description:
      "Tests if the flow passes a particular gather very recently - that is, within the last 3 turns.",
    file: seenVeryRecently,
  },
  {
    id: "lib-seen-more-recently-than",
    label: "Flow: seen_more_recently_than",
    aliases: ["seen_more_recently_than"],
    description:
      "Tests if the flow has reached one divert more recently than another.",
    file: seenMoreRecentlyThan,
  },
  {
    id: "lib-seen-this-scene",
    label: "Flow: seen_this_scene",
    aliases: ["seen_this_scene"],
    description:
      "Tests if the flow has reached a particular gather this scene.",
    file: seenThisScene,
  },
  {
    id: "lib-thread-in-tunnel",
    label: "Flow: thread_in_tunnel",
    aliases: ["thread_in_tunnel"],
    description:
      "Threads in a given flow as a tunnel, with a given location to tunnel back to.",
    file: threadInTunnel,
  },
  {
    id: "lib-a-or-an",
    label: "Printing: a (or an)",
    aliases: ["a"],
    description:
      "Prints the correct form of the indefinite article before a noun.",
    file: aOrAn,
  },
  {
    id: "lib-uppercase",
    label: "Printing: UPPERCASE",
    aliases: ["UPPERCASE"],
    description: "Converts text to uppercase. Needs a host binding to work.",
    file: uppercase,
  },
  {
    id: "lib-print-number",
    label: "Printing: print_number",
    aliases: ["print_number"],
    description:
      "Converts a number between -1,000,000,000 and 1,000,000,000 into its printed (integer) equivalent.",
    file: printNumber,
  },
  {
    id: "lib-list-with-commas",
    label: "Printing: list_with_commas",
    aliases: ["list_with_commas"],
    description: "Takes a list and prints it out, using commas.",
    file: listWithCommas,
  },
  {
    id: "lib-list-to-number",
    label: "Systems: List items as integer variables",
    aliases: ["listToNumber", "_getValueOfState", "_setValueOfState"],
    description:
      "A system for assigning, reading and altering integer values to list items.",
    file: listToNumber,
  },
  {
    id: "lib-swing-variables",
    label: "Systems: Swing variables",
    aliases: ["swing_variables", "raise", "lower"],
    description:
      "A system for tracking good and bad actions, and returning the proportion the player has encountered so far.",
    file: swingVariables,
  },
  {
    id: "lib-storylets",
    label: "Systems: Storylets",
    aliases: ["storylets", "listAvailableStorylets"],
    description:
      "A storylet implementation: chunks of content gated by preconditions, offered a few at a time.",
    file: storylets,
  },
];

function toSnippet(entry: LibraryEntry): InkSnippet {
  const text = toLibrarySnippetText(entry.file);
  return {
    id: entry.id,
    label: entry.label,
    category: "Library",
    context: "top-level",
    aliases: entry.aliases,
    desktopSnippet: text,
    mobileInsert: text,
    description: entry.description,
    source: "library",
  };
}

/** inkle's longer snippets, ready to insert. */
export const LIBRARY_SNIPPETS: InkSnippet[] = ENTRIES.map(toSnippet);
