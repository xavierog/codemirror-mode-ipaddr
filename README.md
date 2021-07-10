# CodeMirror IP addresses (ipaddr) mode

This is a [CodeMirror](https://codemirror.net/) mode that provides syntax highlighting for IP addresses.
It supports regular addresses, CIDR notations and ranges for both IPv4 and IPv6. Dual addresses are also supported.

## How to use
### Basic use
Load `ipaddr.js` at an adequate location in your HTML structure.
Mention `mode: 'ipaddr'` when creating your CodeMirror instance or, better, `mode: 'text/x-ip-address'`.

### Configuration
Whether or not to recognize CIDR notations and IP ranges can be set using the following boolean options: `ipv4_cidr`, `ipv6_cidr`, `ipv4_ranges`, `ipv6_ranges`.
By default, codemirror-mode-ipaddr highlights only the first part of the first line and marks everything else as erroneous. This is called strict mode and it can be disabled through `strict: false`.
Refer to the demo page for further explanations.

### Theming
This mode leverages CodeMirror's default tokens (number, punctuation, meta, attribute and error) and should therefore fit in with all CodeMirror themes.

### Nesting
codemirror-mode-ipaddr was designed to be nested within another mode, i.e. to highlight IP addresses for another mode
(of course, this requires adjusting the other mode).
This is why strict mode is enabled by default.
It may also be used to highlight IP addresses in [single-line CodeMirror input fields](https://github.com/isaacev/codemirror-no-newlines).

## License
This mode is released under the 3-clause BSD license.
