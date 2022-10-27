import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import System from '@/api/system'
import Oauth from '@/api/oauth'
import { messageFrom } from '@/utils'

export interface UserAuth extends API.SysToken {
  express_time: number
}

const localUserInfo = useLocalStorage<API.SysUserVo>('__ys_user_info', {})
const localUserAuth = useLocalStorage<Partial<UserAuth>>('__ys_dadian_auth', {})

export const useUserStore = defineStore('user-info', {
  state: () => ({
    auth: localUserAuth.value,
    info: localUserInfo.value,
  }),
  getters: {
    /** TODO: 等后端返回改为单角色后就不需要这个了 */
    role: (state) => {
      return state.info.roleList?.[0]
    },
    /** 根据权限筛选出的全部可访问路由，只能在 router 以外的地方调用 */
    routes: (state) => {
      const router = useRouter()
      const { roleList = [] } = state.info
      if (!roleList.length)
        return []
      return router.getRoutes().filter(record => record.meta?.roles?.includes(roleList[0]?.code ?? '') ?? true)
    },
    /** 根据权限筛选出的一级菜单的路由 */
    menuRoutes: (state) => {
      const router = useRouter()
      const routes = router.getRoutes().find(item => item.path === '/')?.children ?? []
      const { roleList = [] } = state.info
      if (!roleList.length)
        return []
      return routes.filter(record => record.meta?.roles?.includes(roleList[0]?.code ?? '') ?? true)
    },
  },
  actions: {
    /** 计算 token 到期时间 */
    getExpressTime(expiresIn?: number) {
      return new Date().getTime() + 1000 * (expiresIn ?? 0)
    },
    /** 检查 token 是否有效 */
    validateUserToken() {
      const { access_token = '', express_time = 0 } = this.auth
      return access_token && express_time > new Date().getTime()
    },
    /** 登出并清理鉴权信息 */
    logout() {
      this.auth = {}
      this.info = {}
      localUserAuth.value = null
      localUserInfo.value = null
    },
    /** 登录（密码模式） */
    async login(loginForm: API.SysTokenVO) {
      try {
        const auth = await Oauth.oauth.token(loginForm)
        const userAuth: UserAuth = {
          ...auth,
          express_time: this.getExpressTime(auth.expires_in),
        }
        this.auth = userAuth
        localUserAuth.value = userAuth
      }
      catch (err) {
        ElMessage.error(messageFrom(err))
      }
    },
    /** 更新用户信息 */
    async updateUserInfo() {
      if (!this.auth.userId)
        return
      try {
        const { data = {} } = await System.sysUserController.getUserInfo({ userId: this.auth.userId })
        this.info = data
        localUserInfo.value = data
      }
      catch (err) {
        ElMessage.error(messageFrom(err))
      }
    },
  },
})