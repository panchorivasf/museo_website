/**
 * Character-level diff of two short strings, used to show exactly where a name
 * typed in the admin differs from the one GBIF returned ("Zonotrichia capensis"
 * vs "Zonotrichia capensis chilensis") instead of only reporting that it differs.
 *
 * Returns one segment list per side; a segment is `{ text, changed }`, where
 * `changed` marks characters missing from the other side.
 */

// Scientific names are short. The LCS table is O(n·m), so refuse pathological
// input rather than allocating a huge table: the caller just highlights it all.
const MAX_LENGTH = 200;

export function diffChars(a = '', b = '') {
  const left = [];
  const right = [];
  const push = (arr, text, changed) => {
    const last = arr[arr.length - 1];
    if (last && last.changed === changed) last.text += text;
    else arr.push({ text, changed });
  };

  if (a.length > MAX_LENGTH || b.length > MAX_LENGTH) {
    if (a) push(left, a, true);
    if (b) push(right, b, true);
    return { left, right };
  }

  const n = a.length;
  const m = b.length;
  // dp[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(left, a[i], false);
      push(right, b[j], false);
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(left, a[i], true);
      i++;
    } else {
      push(right, b[j], true);
      j++;
    }
  }
  while (i < n) push(left, a[i++], true);
  while (j < m) push(right, b[j++], true);

  return { left, right };
}
