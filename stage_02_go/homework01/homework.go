package homework01

import (
	"sort"
)

// 1. 只出现一次的数字
// 给定一个非空整数数组，除了某个元素只出现一次以外，其余每个元素均出现两次。找出那个只出现了一次的元素。
func SingleNumber(nums []int) int {
	// m := make(map[int]int, len(nums))
	// for _, v := range nums {
	// 	m[v] += 1
	// }
	// for k := range m {
	// 	if m[k] == 1 {
	// 		return k
	// 	}
	// }
	result := 0
	for _, v := range nums {
		result ^= v
	}
	return result
}

// 2. 回文数
// 判断一个整数是否是回文数
// 回文数是指正序（从左向右）和倒序（从右向左）读都是一样的整数。
// 例如，11, 121 是回文，而 123, -121 不是。
func IsPalindrome(x int) bool {
	// if x < 0 {
	// 	return false
	// }

	// s := strconv.Itoa(x)
	// for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
	// 	if s[i] != s[j] {
	// 		return false
	// 	}
	// }

	// return true

	if x < 0 || (x%10 == 0 && x != 0) {
		return false
	}
	reverted := 0
	for x > reverted {
		reverted = reverted*10 + x%10
		x /= 10
	}
	return x == reverted || x == reverted/10
}

// 3. 有效的括号
// 给定一个只包括 '(', ')', '{', '}', '[', ']' 的字符串，判断字符串是否有效
func IsValid(s string) bool {
	// 使用栈是借助 AI 的思路, 自己没想到
	pairs := map[byte]byte{
		')': '(',
		']': '[',
		'}': '{',
	}
	stack := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if open, isClose := pairs[ch]; isClose {
			if len(stack) == 0 || stack[len(stack)-1] != open {
				return false
			}
			// 匹配到 右括号 出栈
			stack = stack[:len(stack)-1]
		} else {
			// 左括号入栈
			stack = append(stack, ch)
		}
	}

	return len(stack) == 0
}

// 4. 最长公共前缀
// 查找字符串数组中的最长公共前缀
// 示例 1：
// 输入：strs = ["flower","flow","flight"]
// 输出："fl"
// 示例 2：
// 输入：strs = ["dog","racecar","car"]
// 输出：""
// 解释：输入不存在公共前缀。
func LongestCommonPrefix(strs []string) string {
	if len(strs) == 0 {
		return ""
	}

	for i := 0; i < len(strs[0]); i++ {
		ch := strs[0][i]
		for j := 0; j < len(strs); j++ {
			if i >= len(strs[j]) || strs[j][i] != ch {
				return strs[0][:i]
			}
		}
	}

	return strs[0]
}

// 5. 加一
// 给定一个由整数组成的非空数组所表示的非负整数，在该数的基础上加一
//
//	{
//		{"Example 1", []int{1, 2, 3}, []int{1, 2, 4}},
//		{"Example 2", []int{4, 3, 2, 1}, []int{4, 3, 2, 2}},
//		{"Example 3", []int{0}, []int{1}},
//		{"Example 4", []int{9}, []int{1, 0}},
//	}
func PlusOne(digits []int) []int {
	if len(digits) == 0 {
		return digits
	}

	for i := len(digits) - 1; i >= 0; i-- {
		if digits[i] < 9 {
			digits[i]++
			return digits
		}
		digits[i] = 0
	}
	return append([]int{1}, digits...)
}

// 6. 删除有序数组中的重复项
// 给你一个有序数组 nums ，请你原地删除重复出现的元素，使每个元素只出现一次，返回删除后数组的新长度。
// 不要使用额外的数组空间，你必须在原地修改输入数组并在使用 O(1) 额外空间的条件下完成。
// 可以使用双指针法，一个慢指针 `i` 用于记录不重复元素的位置，一个快指针 `j` 用于遍历数组，
// 当 `nums[i]` 与 `nums[j]` 不相等时，将 `nums[j]` 赋值给 `nums[i + 1]`，并将 `i` 后移一位
//
//	{
//		{"Example 1", []int{1, 1, 2}, 2, []int{1, 2}},
//		{"Example 2", []int{0, 0, 1, 1, 1, 2, 2, 3, 3, 4}, 5, []int{0, 1, 2, 3, 4}},
//	}
func RemoveDuplicates(nums []int) int {
	if len(nums) == 0 {
		return 0
	}
	slow := 0
	for fast := 1; fast < len(nums); fast++ {
		if nums[fast] != nums[slow] {
			slow++
			nums[slow] = nums[fast]
		}
	}

	return slow + 1
}

// 7. 合并区间
// 以数组 intervals 表示若干个区间的集合，其中单个区间为 intervals[i] = [starti, endi] 。
// 请你合并所有重叠的区间，并返回一个不重叠的区间数组，该数组需恰好覆盖输入中的所有区间。
//
//	{
//		{"Example 1", [][]int{{1, 3}, {2, 6}, {8, 10}, {15, 18}}, [][]int{{1, 6}, {8, 10}, {15, 18}}},
//		{"Example 2", [][]int{{1, 4}, {4, 5}}, [][]int{{1, 5}}},
//	}
func Merge(intervals [][]int) [][]int {
	if len(intervals) == 0 {
		return intervals
	}

	// 按每个区间的第一个元素排序
	sort.Slice(intervals, func(i, j int) bool {
		return intervals[i][0] < intervals[j][0]
	})

	result := make([][]int, 0, len(intervals))
	result = append(result, intervals[0])
	for i := 1; i < len(intervals); i++ {
		last := result[len(result)-1]
		cur := intervals[i]

		if cur[0] <= last[1] {
			// 重叠: 扩大右端点
			if cur[1] > last[1] {
				last[1] = cur[1]
			}
		} else {
			result = append(result, cur)
		}
	}

	return result
}

// 8. 两数之和
// 给定一个整数数组 nums 和一个目标值 target，请你在该数组中找出和为目标值的那两个整数
//
//	{
//		{"Example 1", []int{2, 7, 11, 15}, 9, []int{0, 1}},
//		{"Example 2", []int{3, 2, 4}, 6, []int{1, 2}},
//		{"Example 3", []int{3, 3}, 6, []int{0, 1}},
//	}
func TwoSum(nums []int, target int) []int {
	seen := make(map[int]int, len(nums))
	for i, num := range nums {
		// 先问 map："我要找的那个搭档在不在？" 在就直接返回，不在就把自己登记上去等后面的人来找
		if n, ok := seen[target-num]; ok {
			return []int{n, i}
		}
		seen[num] = i
	}
	return nil
}
