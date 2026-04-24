pub(super) fn calculate_similarity_score(query: &str, name: &str) -> f32 {
    let query_lower = query.to_lowercase();
    let name_lower = name.to_lowercase();

    if name_lower == query_lower {
        return 1.0;
    }

    if name_lower.starts_with(&query_lower) {
        return 0.95 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.05;
    }

    if name_lower.contains(&query_lower) {
        return 0.8 + (query_lower.len() as f32 / name_lower.len() as f32) * 0.15;
    }

    let query_tokens: Vec<&str> = query_lower
        .split(|character: char| {
            character.is_whitespace() || character == '.' || character == '_' || character == '-'
        })
        .filter(|segment| !segment.is_empty())
        .collect();
    let name_tokens: Vec<&str> = name_lower
        .split(|character: char| {
            character.is_whitespace() || character == '.' || character == '_' || character == '-'
        })
        .filter(|segment| !segment.is_empty())
        .collect();

    if !query_tokens.is_empty() && !name_tokens.is_empty() {
        let mut matched_count = 0;
        let mut partial_match_score = 0.0f32;

        for query_token in &query_tokens {
            let mut best_token_score = 0.0f32;

            for name_token in &name_tokens {
                if *name_token == *query_token {
                    best_token_score = 1.0;
                    break;
                } else if name_token.starts_with(query_token) {
                    best_token_score = best_token_score.max(0.9);
                } else if name_token.contains(query_token) {
                    best_token_score = best_token_score.max(0.8);
                } else {
                    let query_chars: Vec<char> = query_token.chars().collect();
                    let name_chars: Vec<char> = name_token.chars().collect();
                    if !query_chars.is_empty() && !name_chars.is_empty() {
                        let distance = levenshtein_distance(&query_chars, &name_chars);
                        let max_len = query_chars.len().max(name_chars.len());
                        if distance <= 2 && max_len > 0 {
                            let similarity = 1.0 - (distance as f32 / max_len as f32);
                            best_token_score = best_token_score.max(similarity * 0.7);
                        }
                    }
                }
            }

            if best_token_score > 0.5 {
                matched_count += 1;
            }
            partial_match_score += best_token_score;
        }

        let match_ratio = matched_count as f32 / query_tokens.len() as f32;
        let average_token_score = partial_match_score / query_tokens.len() as f32;

        if match_ratio >= 0.5 {
            return 0.6 + (match_ratio * 0.2) + (average_token_score * 0.15);
        }
    }

    let query_chars: Vec<char> = query_lower.chars().collect();
    let name_chars: Vec<char> = name_lower.chars().collect();

    if query_chars.is_empty() || name_chars.is_empty() {
        return 0.0;
    }

    let distance = levenshtein_distance(&query_chars, &name_chars);
    let max_len = query_chars.len().max(name_chars.len()) as f32;
    let similarity = 1.0 - (distance as f32 / max_len);

    similarity.max(0.0)
}

fn levenshtein_distance(first: &[char], second: &[char]) -> usize {
    let first_len = first.len();
    let second_len = second.len();

    if first_len == 0 {
        return second_len;
    }
    if second_len == 0 {
        return first_len;
    }

    let mut previous_row: Vec<usize> = (0..=second_len).collect();
    let mut current_row: Vec<usize> = vec![0; second_len + 1];

    for row_index in 1..=first_len {
        current_row[0] = row_index;

        for column_index in 1..=second_len {
            let cost = if first[row_index - 1] == second[column_index - 1] {
                0
            } else {
                1
            };

            current_row[column_index] = (previous_row[column_index] + 1)
                .min(current_row[column_index - 1] + 1)
                .min(previous_row[column_index - 1] + cost);
        }

        std::mem::swap(&mut previous_row, &mut current_row);
    }

    previous_row[second_len]
}

pub(super) fn get_min_score_for_query_length(query_length: usize) -> f32 {
    match query_length {
        1..=3 => 0.9,
        4..=6 => 0.65,
        7..=9 => 0.55,
        _ => 0.5,
    }
}

#[cfg(test)]
mod tests {
    use super::{calculate_similarity_score, get_min_score_for_query_length};

    #[test]
    fn exact_match_scores_highest() {
        assert_eq!(calculate_similarity_score("Readme.md", "Readme.md"), 1.0);
    }

    #[test]
    fn prefix_match_scores_above_partial() {
        let prefix_score = calculate_similarity_score("read", "readme.md");
        let partial_score = calculate_similarity_score("adme", "readme.md");
        assert!(prefix_score > partial_score);
    }

    #[test]
    fn score_threshold_relaxes_for_longer_queries() {
        assert!(get_min_score_for_query_length(3) > get_min_score_for_query_length(8));
    }
}
