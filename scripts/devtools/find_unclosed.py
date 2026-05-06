import sys

def check_brackets(filepath):
    with open(filepath, 'r') as f:
        text = f.read()

    stack = []
    line_num = 1
    in_string = False
    string_char = ''
    in_comment = False
    in_template = False

    i = 0
    while i < len(text):
        c = text[i]
        
        if c == '\n':
            line_num += 1
            if in_comment and string_char == '//':
                in_comment = False
        elif not in_string and not in_comment and not in_template:
            if text[i:i+2] == '//':
                in_comment = True
                string_char = '//'
                i += 1
            elif text[i:i+2] == '/*':
                in_comment = True
                string_char = '/*'
                i += 1
            elif c in "'\"":
                in_string = True
                string_char = c
            elif c == '`':
                in_template = True
            elif c in "([{<":
                stack.append((c, line_num))
            elif c in ")]}>":
                if not stack:
                    pass
                else:
                    top_c, _ = stack[-1]
                    if (top_c == '(' and c == ')') or \
                       (top_c == '[' and c == ']') or \
                       (top_c == '{' and c == '}') or \
                       (top_c == '<' and c == '>'):
                        stack.pop()
                    else:
                        # Angle brackets in TSX can be tricky, so we don't strictly enforce <> pairing if it mismatches
                        if c == '>':
                            # pop any <
                            for j in range(len(stack)-1, -1, -1):
                                if stack[j][0] == '<':
                                    del stack[j:]
                                    break
        elif in_string:
            if c == '\\':
                i += 1
            elif c == string_char:
                in_string = False
        elif in_template:
            if c == '\\':
                i += 1
            elif c == '`':
                in_template = False
            elif text[i:i+2] == '${':
                stack.append(('{', line_num))
                in_template = False # wait, this requires full parser. Let's just ignore template internals for a simple check.
                i += 1
        elif in_comment and string_char == '/*':
            if text[i:i+2] == '*/':
                in_comment = False
                i += 1
        
        i += 1

    # Print remaining stack for '('
    for bracket, ln in stack:
        if bracket == '(':
            print(f"Unclosed '(' from line {ln}")

check_brackets('src/components/ExplorerAudioWorkbench.tsx')
