CodeMirror.defineMode('ipaddr', function(editor_options) {
	var
		UNKNOWN = 0,
		IPV4 = 1, // Pure IPv4 address
		IPV6 = 2, // Pure IPv6 address
		DUAL = 3; // Dual IPv6+IPv4 address, e.g. 2001:db8::1234:5678:5.6.7.8

	// Default settings:
	var options = {
		ipv4_ranges: true, // Accept IPv4 ranges, e.g. 10.0.0.0-10.255.255.255
		ipv6_ranges: true, // Accept IPv6 ranges, e.g. 2001:0db8::-2001:0db8:ffff:ffff:ffff:ffff:ffff:ffff
		ipv4_cidr: true,   // Accept IPv4 CIDR, e.g. 10.0.0.0/8
		ipv6_cidr: true,   // Accept IPv6 CIDR, e.g. 2001:db8::/32
		strict: true,      // Strict mode: accept only one address or range (relevant as a nested mode)
		default_state: UNKNOWN, // default state; best set through a MIME type
	};

	// Override options.default_state if invoked through a MIME type:
	var invoked_named = typeof editor_options.mode === 'string' ? editor_options.mode : editor_options.mode.name;
	if (invoked_named === 'text/x-ipv4-address') options.default_state = IPV4;
	else if (invoked_named === 'text/x-ipv6-address') options.default_state = IPV6;

	// Override default settings with user-provided settings:
	var user_options = typeof editor_options.mode === 'string' ? {} : editor_options.mode;
	for (option in options) {
		if (option in user_options) options[option] = user_options[option];
	}

	// Helpers:
	ipv4_re = new RegExp('^(?:\\d+\\.){1,3}\\d*');
	function error(stream, state) {
		if (options.strict) state.mark_as_error = true;
		reset(state);
		if (!stream.current()) stream.next();
		return 'error';
	}
	function guess_mode(stream, state) {
		var rem;
		// Determine whether we should expect an IPv4 or IPv6 address based on
		// the first encountered separator:
		if (rem = stream.match(/^[^.:]*([.:])/, false)) {
			reset(state);
			state.current_mode = rem[1] === '.' ? IPV4 : IPV6;
		}
	}
	function ipv6_accept_trailing_ipv4(state) {
		// An IPv6 address has up to 8 blocks.
		// A trailing IPv4 is 32 bits, i.e. 2 blocks.
		// A double-colon represents at least 2 blocks.
		// Consequently:
		// if the current IP address features a double-colon *and*
		// a trailing IPv4, it cannot have more than 4 blocks (8 - 2 - 2):
		if (state.double_colon) return state.block_count <= 4;
		// if the current IP address does not feature a double-colon but
		// features a trailing IPv4, then it must have exactly 6 blocks (8 - 2):
		return state.block_count === 6;
	}
	function ipv6_enough_bits(state) {
		return state.double_colon ? true : (state.block_count === 8);
	}
	function ipv6_max_blocks(state) {
		return state.double_colon ? 6 : 8;
	}

	// Handlers:
	function handle_cidr_suffix(stream, state) {
		if (state.range) return false;
		var rem;
		if (!state.cidr) {
			if (stream.eat('/')) {
				state.cidr = true;
				return 'meta';
			}
			return false;
		} else if (rem = stream.match(/^(\d+)/)) {
			if (Number(rem[1]) <= (state.current_mode === IPV4 ? 32 : 128)) {
				if (options.strict) state.mark_as_error = true;
				reset(state);
				return 'attribute';
			}
		}
		return error(stream, state);
	}

	function handle_range(stream, state) {
		if (!state.range && stream.eat('-')) {
			var new_mode = (state.current_mode === IPV4) ? IPV4 : IPV6;
			reset(state);
			// Ensure the second address is the same type as the first one:
			state.current_mode = new_mode;
			state.range = true;
			return 'attribute';
		}
		return false;
	}

	function handle_ipv4(stream, state) {
		if (state.block_count === 4) {
			var ret;
			if (options.ipv4_cidr) {
				if (ret = handle_cidr_suffix(stream, state)) return ret;
			}
			if (options.ipv4_ranges) {
				if (ret = handle_range(stream, state)) return ret;
			}
			// All done:
			reset(state);
			if (options.strict) state.mark_as_error = true;
		}
		if (state.expect_dot && stream.match('.')) {
			state.expect_dot = false;
			return 'punctuation';
		}
		if (rem = stream.match(/^(\d+)/)) {
			if (Number(rem[1]) < 256) {
				++ state.block_count;
				state.expect_dot = state.block_count < 4; 
				return 'number';
			}
		}
		return error(stream, state);
	}


	function handle_ipv6(stream, state) {
		if (ipv6_enough_bits(state)) {
			var ret;
			if (options.ipv6_cidr) {
				if (ret = handle_cidr_suffix(stream, state)) return ret;
			}
			if (options.ipv6_ranges) {
				if (ret = handle_range(stream, state)) return ret;
			}
		}
		if (state.expect_digits) {
			// Handle dual addresses:
			if (stream.match(ipv4_re, false)) {
				if (ipv6_accept_trailing_ipv4(state)) {
					reset(state);
					state.current_mode = DUAL;
					return tokenBase(stream, state);
				}
				stream.match(ipv4_re);
				return 'error';
			}
			else if (stream.match(/^([0-9a-fA-F]{1,4})/)) {
				++ state.block_count;
				state.expect_colon = state.block_count < ipv6_max_blocks(state);
				state.expect_double_colon = !state.double_colon && state.block_count <= 6;
				state.expect_digits = false;
				return 'number';
			}
		}
		if (state.expect_double_colon && stream.match('::')) {
			state.double_colon = true; // mark the use of a double-colon
			state.expect_colon = false;
			state.expect_double_colon = false;
			state.expect_digits = state.block_count < 6;
			return 'punctuation';
		}
		if (state.expect_colon && stream.eat(':')) {
			state.expect_colon = false;
			state.expect_double_colon = false;
			state.expect_digits = state.block_count < ipv6_max_blocks(state);
			return 'punctuation';
		}
		return error(stream, state);
	}

	function tokenBase(stream, state) {
		if (stream.sol() && !state.just_begun) { // 2nd line or more
			if (options.strict) state.mark_as_error = true; // forbidden in strict mode
			reset(state);
		}
		if (state.just_begun) delete state.just_begun;
		if (state.mark_as_error) return error(stream, state);
		if (state.cidr) return handle_cidr_suffix(stream, state);
		if (state.current_mode === UNKNOWN) guess_mode(stream, state);
		if (state.current_mode === IPV6) return handle_ipv6(stream, state);
		if (state.current_mode & IPV4) return handle_ipv4(stream, state);
		return error(stream, state);
	}

	function reset(state) {
		state.current_mode = options.default_state;
		state.block_count = 0;
		state.range = state.cidr = false;
		// IPv4-specific:
		state.expect_dot = false;
		// IPv6-specific:
		state.expect_digits = state.expect_double_colon = true;
		state.expect_colon = state.double_colon = false;
		return state;
	}

	return {
		startState: function() { return reset({just_begun: true}); },
		token: tokenBase,
	};
});

CodeMirror.defineMIME('text/x-ip-address',   'ipaddr');
CodeMirror.defineMIME('text/x-ipv4-address', 'ipaddr');
CodeMirror.defineMIME('text/x-ipv6-address', 'ipaddr');
