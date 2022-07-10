module.exports = `

local pickle = require('pickle')
local yaml = require('yaml')

function string.levenshtein(str1, str2)
	local len1 = string.len(str1)
	local len2 = string.len(str2)
	local matrix = {}
	local cost = 0

        -- quick cut-offs to save time
	if (len1 == 0) then
		return len2
	elseif (len2 == 0) then
		return len1
	elseif (str1 == str2) then
		return 0
	end

        -- initialise the base matrix values
	for i = 0, len1, 1 do
		matrix[i] = {}
		matrix[i][0] = i
	end
	for j = 0, len2, 1 do
		matrix[0][j] = j
	end

        -- actual Levenshtein algorithm
	for i = 1, len1, 1 do
		for j = 1, len2, 1 do
			if (str1:byte(i) == str2:byte(j)) then
				cost = 0
			else
				cost = 1
			end

			matrix[i][j] = math.min(matrix[i-1][j] + 1, matrix[i][j-1] + 1, matrix[i-1][j-1] + cost)
		end
	end

        -- return the last value - this is the Levenshtein distance
	return matrix[len1][len2]
end

box.schema.space.create('memes', {if_not_exists=true})
box.space.memes:format({{name = 'id', type = 'string'},{name = 'u_text', type = 'string'},{name = 'b_text', type = 'string'},{name = 'image', type = 'string'}})
box.space.memes:create_index('primary', {type = 'tree', parts = {'id'}, if_not_exists=true})
box.space.memes:create_index('text', {type = 'tree', parts = {'u_text'}, if_not_exists=true, unique=false})
box.space.memes:create_index('image', {type = 'tree', parts = {'image'}, if_not_exists=true, unique=false})

function tmp_sort(a,b)
    if  a.rast < b.rast then
        return true
    end
    return false
end

function find_meme(name_part)

    local res = {}
    local rast

    for v, t in box.space.memes:pairs() do
        rast = string.levenshtein(name_part, t[2] .. t[3])
        table.insert(res, {id = t[1], rast = rast, text = t[2] .. t[3]})
    end

    table.sort(res, function (a,b) return (a.rast < b.rast) end)
    return res[1]
end

`