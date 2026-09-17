import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import UserGeneral from '@/components/shadcn-studio/blocks/account-settings-01/account-settings-01'

const tabs = [
  { name: 'General', value: 'general' },
  { name: 'Preferences', value: 'preferences' },
  { name: 'Users', value: 'users' }
]

const TabsUnderlineDemo = () => {
  return (
    <div className='w-full py-8'>
      <div className='mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='mt-4'>
          <UserGeneral />
        </div>
      </div>
    </div>
  )
}

export default TabsUnderlineDemo
